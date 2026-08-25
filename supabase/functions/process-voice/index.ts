import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'google/gemini-3.6-flash';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Unit { index: number; label?: string; text: string }
interface UnitSection { title: string; units: Unit[] }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ error: 'LOVABLE_API_KEY no está configurada' }, 500);

    // --- Auth: solo usuarios logueados ---
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'No autenticado' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: 'No autenticado' }, 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Body inválido' }, 400);

    const mode: string = body.mode;
    const transcript: string = typeof body.transcript === 'string' ? body.transcript.trim() : '';
    if (!transcript) return json({ error: 'No hay texto dictado' }, 400);
    if (transcript.length > 8000) return json({ error: 'El dictado es demasiado largo' }, 400);

    let systemPrompt = '';
    let toolSchema: any = null;

    if (mode === 'findings_v2') {
      const unitSections: UnitSection[] = Array.isArray(body.unitSections) ? body.unitSections : [];
      const unitsText = unitSections
        .map((s) =>
          `[${s.title}]\n` +
          (s.units || [])
            .map((u) => `  #${u.index}${u.label ? ` (${u.label})` : ''}: ${u.text}`)
            .join('\n'),
        )
        .join('\n\n');

      systemPrompt = `Eres un médico ecografista experto editando un informe estructurado. El médico dicta de forma NATURAL los hallazgos patológicos.

El informe está dividido en UNIDADES numeradas por sección (cada unidad es un apartado anatómico o una frase de normalidad):
${unitsText || '[Informe]\n  (informe vacío)'}

REGLAS ESTRICTAS:
1. Para CADA hallazgo dictado, identificá la UNIDAD que describe ese mismo órgano/región y REEMPLAZALA (action "replace") por la redacción patológica. NUNCA dejes la frase de normalidad de ese órgano junto al hallazgo: sería una contradicción.
2. Si una unidad contiene varias afirmaciones y solo una cambia, reescribí la unidad completa conservando lo que sigue siendo normal.
3. Solo si NO existe ninguna unidad correspondiente, usá action "append" en la sección "Informe" (unitIndex null).
4. NO toques unidades no relacionadas con el dictado.
5. Conclusión: si el médico la dicta, usala; si no, y existe una unidad de conclusión, reemplazala por un resumen BREVE (1-2 oraciones) SOLO de los hallazgos patológicos. Si no hay hallazgos, no la toques.
6. Respetá el estilo, terminología y formato del texto original (español rioplatense médico).
7. Devolvé el texto FINAL de cada unidad modificada (no fragmentos ni instrucciones).
8. Nunca inventes medidas ni datos que el médico no dictó.`;

      toolSchema = {
        type: 'function',
        function: {
          name: 'apply_findings_units',
          description: 'Aplica hallazgos a unidades específicas del informe',
          parameters: {
            type: 'object',
            properties: {
              unitUpdates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sectionTitle: { type: 'string' },
                    unitIndex: { type: ['number', 'null'], description: 'Índice de la unidad a reemplazar, o null para agregar' },
                    action: { type: 'string', enum: ['replace', 'append', 'delete'] },
                    text: { type: 'string', description: 'Texto final de la unidad' },
                  },
                  required: ['sectionTitle', 'unitIndex', 'action', 'text'],
                  additionalProperties: false,
                },
              },
            },
            required: ['unitUpdates'],
            additionalProperties: false,
          },
        },
      };
    } else if (mode === 'correction') {
      const sectionTitle: string = body.sectionTitle || 'Informe';
      const currentContent: string = body.currentContent || '';
      systemPrompt = `Eres un médico ecografista editando una sección de un informe. El médico va a dictar una corrección o agregado.

SECCIÓN: "${sectionTitle}"

TEXTO ACTUAL DE LA SECCIÓN:
${currentContent}

Aplicá lo que dicte el médico al TEXTO ACTUAL:
- Si dice "cambiá X por Y" o "donde dice X poné Y", reemplazá esa frase.
- Si dice "agregá..." o menciona un hallazgo nuevo, agregalo en la posición anatómica correcta.
- Si dice "borrar todo y poner..." o "empezar de nuevo...", reemplazá toda la sección.
- Si solo dicta hallazgos naturales, integralos reemplazando las frases de normalidad correspondientes.
- Mantené redacción médica profesional y formato consistente. Nunca inventes medidas.

Devolvé el texto COMPLETO final de la sección, una línea por apartado.`;
      toolSchema = {
        type: 'function',
        function: {
          name: 'correct_section',
          description: 'Corrige una sección',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Texto completo final de la sección' },
            },
            required: ['content'],
            additionalProperties: false,
          },
        },
      };
    } else {
      return json({ error: `Modo desconocido: ${mode}` }, 400);
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Lovable-API-Key': LOVABLE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Dictado del médico: "${transcript}"` },
        ],
        tools: [toolSchema],
        tool_choice: { type: 'function', function: { name: toolSchema.function.name } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: 'Límite excedido. Intente en unos segundos.' }, 429);
      if (response.status === 402) return json({ error: 'Créditos de IA insuficientes.' }, 402);
      console.error('AI gateway error:', response.status, await response.text());
      return json({ error: 'Error del servicio de IA' }, 500);
    }

    const data = await response.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return json({ error: 'No se pudo procesar el dictado' }, 500);

    return json(JSON.parse(args));
  } catch (e) {
    console.error('process-voice error:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
