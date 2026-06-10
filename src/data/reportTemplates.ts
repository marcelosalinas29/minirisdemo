export interface ReportTemplate {
  name: string;
  content: string;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    name: 'Ecografía Abdominal',
    content: `Hígado: de forma, tamaño y ecoestructura conservados, sin lesiones focales en los segmentos explorados.
Vía biliar: intra y extrahepática no dilatadas.
Vesícula: de paredes finas y contenido líquido homogéneo. Alitiásica.
Páncreas: parénquima homogéneo, sin imágenes a destacar.
Bazo: de forma, tamaño y ecoestructura conservados.
Riñones: ortotópicos, de forma y tamaño conservados. Adecuada diferenciación corticomedular.
Aorta: calibre y recorrido conservados.
No se observa líquido libre en cavidad.`,
  },
  {
    name: 'Ecografía Renal',
    content: `Riñón derecho: Long: mm  AP: mm Axial: mm. Espesor cortical conservado.
Riñón izquierdo: Long: mm  AP: mm Axial: mm. Espesor cortical conservado.
Ambos riñones de forma, tamaño y ecoestructura conservados, sin signos de quistosis o macrolitiasis.
Vías excretoras: no dilatadas.`,
  },
  {
    name: 'Renal y Vesicoprostática',
    content: `Riñón derecho: Long: mm AP: mm Axial: mm. Espesor cortical conservado.
Riñón izquierdo: Long: mm AP: mm Axial: mm. Espesor cortical conservado.
Ambos riñones de forma, tamaño y ecoestructura conservados, sin signos de macrolitiasis.
Vías excretoras: no dilatadas.
Vejiga: de paredes finas y contenido líquido homogéneo.
Volumen premiccional:  cc. RPM:  cc.
Próstata: CP: mm. AP: mm. Axial: mm de ecoestructura finamente no homogénea. Volumen:      cc.`,
  },
  {
    name: 'Ecografía Tiroidea',
    content: `Glándula tiroidea de forma, tamaño y ecoestructura conservados.
LOBULO DERECHO:
Long.: mm.  AP.:   mm. Trans.:  mm.
LOBULO IZQUIERDO:
Long.: mm.  AP.: mm. Trans.:  mm.
ISTMO:     mm.`,
  },
  {
    name: 'Ecografía Mamaria',
    content: `Ambas mamas con tejido fibroglandular heterogéneo y moderado tejido adiposo.
Mama derecha: No se observan imágenes nodulares sólidas ni quísticas a destacar.
Mama izquierda: No se observan imágenes nodulares sólidas ni quísticas a destacar.
Planos superficiales y posteriores libres.
Axilas libres de adenomegalias. 
BIRADS 1`,
  },
  {
    name: 'Ginecológica TV',
    content: `Útero: en AVF de forma, tamaño y ecoestructura miometrial conservados.
Medidas: Long: mm.  AP: mm. Axial: mm.
Endometrio homogéneo de mm.
Ovario Derecho: mm x mm.
Ovario Izquierdo: mm x mm.
Ambos ovarios de características conservadas para la edad.
Fondo de saco de Douglas libre.`,
  },
  {
    name: 'Mamaria y Ginecológica TV',
    content: `ECOGRAFÍA MAMARIA
Ambas mamas con tejido fibroglandular heterogéneo y moderado tejido adiposo.
Mama derecha: No se observan imágenes nodulares sólidas ni quísticas a destacar.
Mama izquierda: No se observan imágenes nodulares sólidas ni quísticas a destacar.
Planos superficiales y posteriores libres.
Axilas libres de adenomegalias. 
BIRADS 1

ECOGRAFÍA GINECOLÓGICA TV
Útero: en AVF de forma, tamaño y ecoestructura miometrial conservados.
Medidas: Long: mm.  AP: mm. Axial: mm.
Endometrio homogéneo de mm.
Ovario Derecho: mm x mm.
Ovario Izquierdo: mm x mm.
Ambos ovarios de características conservadas para la edad.
Fondo de saco de Douglas libre.`,
  },
  {
    name: 'Obstétrica 1er Trimestre',
    content: `FUM:\t\t\tAmenorrea: 
Útero: en AVF, ocupado por saco gestacional de contornos netos, con embrión vital y móvil en su interior.
Actividad cardioembrionaria: positiva. LCF: lpm.
LCC:   mm correspondiente a  semanas de EG.
Trofoblasto: envolvente, homogéneo. 
Cuello: con ambos orificios cervicales cerrados al momento del estudio.
Regiones anexiales: de características conservadas. 
Fondo de saco de Douglas: libre.
FPP: //2025

CONCLUSION: embarazo único y vital de     semanas de EG por ecografía.`,
  },
  {
    name: 'TN y Doppler Uterino',
    content: `FUM:\t\t\tAmenorrea: 
Útero ocupado por feto único, vital y móvil.  FCF:  lat. x Min.
LEM: 66 mm que corresponden a  semanas de gestación (+/- 5 días).
Trofoblasto: envolvente homogéneo. 
Líquido amniótico: normal cantidad.
Cuello: con ambos orificios cervicales cerrados.
Translucencia Nucal: de  mm.
Hueso nasal: presente.
Ductus venoso: anterógrado. Conservado.
Arteria uterina derecha: IP: 
Arteria uterina izquierda: IP: 
IP medio: , percentilo , dentro de los parámetros normales (VN:<p95)
Fondo de saco de Douglas: libre.
Longitud cervical: conservada.
FPP: 

CONCLUSION: embarazo único y vital de  semanas de EG. TN, hueso nasal y ductus venoso dentro de parámetros normales. Doppler de arterias uterinas conservado.`,
  },
  {
    name: 'Ecografía Obstétrica',
    content: `FUM: //\t\tAMENORREA: semanas
Útero ocupado por feto único, vital y móvil.  FCF:  lat. x Min.
Situación longitudinal, posición cefálica, dorso posterior. 
DBP: mm (semanas).
PC: mm (semanas).
PA: mm (semanas).
FL: mm (semanas).
EG por ecografía: corresponde a semanas.
Peso fetal aproximado: g (+/- 15%) en percentilo para la EG .
Placenta: anterior no previa, grado III de maduración.
Líquido amniótico: normal cantidad.
Cuello: con ambos orificios cervicales cerrados.
FPP: 
CONCLUSION: embarazo único y vital de  semanas de EG.`,
  },
  {
    name: 'Doppler Maternofetal',
    content: `Arteria umbilical: IR: ;  IP:; conservada.
Arteria cerebral media: IR:; conservada.
Arteria uterina derecha: IR: ; IP: . Sin notch.
Arteria uterina izquierda: IR: ; IP: . Sin notch.
No observo signos de redistribución del flujo. 

CONCLUSION: Estudio dentro de parámetros normales.`,
  },
  {
    name: 'Scan Fetal',
    content: `Cabeza: Cráneo de morfología conservada. Línea media entrada, cavum del septum pellucidum presente. Hemisferios cerebrales y cerebelo de características conservadas. Ventrículos no dilatados.
Cara: órbitas, nariz y labios conservados.
Cuello fetal: de aspecto conservado.
Corazón: con cuatro cámaras, adecuada morfología.  FCF: 155 lat. x min.
Diafragma: continuo, sin evidencia de soluciones de continuidad.
Abdomen: Cámara gástrica, hígado, vesícula, ambos riñones y vejiga ortotópicos, de aspecto conservado. Vías excretoras dentro de límites normales.
Columna fetal: sin evidencia actual de falla de cierre.
Extremidades: Se observan cuatro miembros móviles, con tres segmentos cada uno.
Genitales externos: femeninos.
Cordón: con tres vasos.

CONCLUSION: biometría fetal y estudio morfológico dentro de límites normales.`,
  },
  {
    name: 'Ecografía Testicular',
    content: `Testículo derecho:
Long: mm.  Ap: mm. Axial: mm.
De forma, tamaño y ecoestructura conservados.
Epidídimo: Conservado

Testículo izquierdo:
Long: mm.  Ap: mm. Axial: mm.
De forma, tamaño y ecoestructura conservados.
Epidídimo: Conservado`,
  },
  {
    name: 'Ecografía Muscular',
    content: `Se realiza rastreo ecográfico del muslo derecho observándose planos musculares de características ecográficas conservadas.
No se evidencian colecciones a destacar por este método.
Si la clínica lo sugiere completar con otros métodos diagnósticos.`,
  },
  {
    name: 'Ecografía de Hombro',
    content: `Se exploraron ambos hombros de forma comparativa, observándose tendón del musculo subescapular, supra e infraespinoso de aspecto conservado. 
Tendón de la porción larga  del bíceps en corredera.
No se observa líquido en la bursa subacormio-subdeltoidea.`,
  },
  {
    name: 'Ecografía de Caderas',
    content: `ECOGRAFÍA DE CADERAS CON PRUEBAS DE STRESS
Se practicó ecografía de ambas caderas en posición neutra y con maniobras de stress.
Se observa adecuada configuración anatómica de las cabezas femorales.
Núcleos de osificación presentes.
Cobertura acetabular superior al 50%
Las maniobras de stress no provocan luxación ni subluxación de las cabezas femorales.
CONCLUSION: estudio dentro de los parámetros normales.`,
  },
  {
    name: 'Ecografía Cerebral',
    content: `Línea media centrada, sin desplazamientos.
Cuerpo calloso presente.
Sistema ventricular: no dilatado.
Fosa posterior de características ecográficas conservadas.
No observo signos de hemorragia ni otras lesiones a destacar en el presente estudio.`,
  },
  {
    name: 'Doppler Venoso MMII (Completo)',
    content: `LADO DERECHO
Sistema venoso profundo:
Vena femoral común: permeable, compresible y continente.
Vena femoral: permeable, compresible y continente.
Vena poplítea: permeable, compresible y continente.

Sistema venoso superficial:
Vena safena magna: permeable, de calibre conservado y continente.
Vena safena parva: permeable, de calibre conservado y  continente.
No observo vasos perforantes incontinentes para destacar.


LADO IZQUIERDO
Sistema venoso profundo:
Vena femoral común: permeable, compresible y continente.
Vena femoral: permeable, compresible y continente.
Vena poplítea: permeable, compresible y continente.

Sistema venoso superficial:
Vena safena magna: permeable, de calibre conservado y continente.
Vena safena parva: permeable, de calibre conservado y  continente.
No observo vasos perforantes incontinentes para destacar.`,
  },
  {
    name: 'Doppler Venoso MMII (TVP)',
    content: `LADO DERECHO:
SISTEMA VENOSO PROFUNDO
Vena femoral común: permeable y compresible.
Vena femoral superficial: permeable y compresible.
Vena poplítea: permeable y compresible.
Vena tibial posterior: permeable y compresible.
SISTEMA VENOSO SUPERFICIAL
Venas safenas magna y parva: permeables y compresibles.

LADO IZQUIERDO:
SISTEMA VENOSO PROFUNDO
Vena femoral común: permeable y compresible.
Vena femoral superficial: permeable y compresible.
Vena poplítea: permeable y compresible.
Vena tibial posterior: permeable y compresible.
SISTEMA VENOSO SUPERFICIAL
Venas safenas magna y parva: permeables y compresibles.

CONCLUSION: El sistema venoso profundo y superficial, es permeable  y compresible.
No se observan signos de TVP en el presente estudio.`,
  },
  {
    name: 'MIV (Mapeo Insuf. Venosa)',
    content: `Sistema venoso profundo
En el Eco-Doppler venoso de ambos miembros inferiores se exploró el sistema venoso profundo de ambos miembros inferiores a nivel de venas femoral comun, femoral, poplítea, tibiales posteriores y peroneas.
Sistema venoso profundo permeable y compresible, presenta flujo con variación respiratoria y responde adecuadamente a las maniobras dinámicas (compresión manual distal, proximal y Valsalva). Sin signos de trombosis al momento del estudio.

Sistema venoso superficial 
Vena safena magna de calibre conservado y continente a nivel de cayado y en todo su recorrido.
Vena safena parva: ostium de calibre conservado y continente.
No se observan venas perforantes insuficientes a destacar.`,
  },
  {
    name: 'Doppler Arterial MMII',
    content: `LADO DERECHO:
Arteria femoral común: permeable con espectro trifásico.
Arteria femoral superficial: permeable con espectro trifásico.
Arteria poplítea: permeable con espectro trifásico.
Arteria tibial posterior: permeable con  espectro trifásico de velocidad conservada.
Arteria tibial  anterior: permeable con  espectro trifásico de velocidad conservada.

LADO IZQUIERDO:
Arteria femoral común: permeable con espectro trifásico.
Arteria femoral superficial: permeable con  espectro trifásico.
Arteria poplítea: permeable con espectro trifásico.
Arteria tibial posterior: permeable con  espectro trifásico de velocidad conservada.
Arteria tibial anterior: permeable con  espectro trifásico de velocidad conservada.

CONCLUSION:
Todos los vasos explorados mostraron permeabilidad y  calibres normales con  sonogramas trifásicos de amplitud conservada.`,
  },
  {
    name: 'Ecodoppler Aorta Abdominal',
    content: `Se realiza rastreo ecográfico Doppler color de la aorta  abdominal  y arterias ilíacas  presentando calibres y recorridos conservados con diámetros máximos de   mm para la aorta y    mm para las arterias ilíacas.
Todos los vasos explorados se encuentran permeables con  flujo trifásico sin alteraciones hemodinámicas y libres de ateromas.

CONCLUSION:
Estudio dentro de parámetros normales.`,
  },
  {
    name: 'Ecodoppler Arterias Renales',
    content: `Ambos riñones de forma, tamaño y ecoestructura conservados. 
Vías excretoras no dilatadas.
Aorta de recorrido y calibre conservados, presenta flujo trifásico sin alteraciones hemodinámicas.
Arterias renales a nivel del ostium, tercio medio e hilios con espectros monofásicos de flujo normales. Sin evidencia de alteraciones hemodinámicas significativas.
Arterias intrarrenales (segmentarias, interlobares y arcuatas) con espectros monofásicos e índices de resistencia conservados menores a 0,7.-

CONCLUSION:
Estudio dentro de parámetros normales.`,
  },
  {
    name: 'Doppler Hepático',
    content: `Venas suprahepáticas (derecha, media e izquierda) con flujo trifásico hepatófugo.
Vena porta de      mm, permeable, con flujo hepatopetal, variación respiratoria, de velocidad normal
Arteria hepática con IR:        , conservado.
Vena esplénica de     mm, con flujo hepatopetal de velocidad normal.
No se observa circulación colateral.

CONCLUSION:
Doppler esplenoportal dentro de parámetros normales.`,
  },
  {
    name: 'Doppler Arterial MMSS',
    content: `Arterias subclavia, axilar, braquial, radial y cubital con diámetros conservados, paredes lisas y flujos trifásicos de velocidad normal.
Arco palmar con buen relleno.

CONCLUSION:
Estudio dentro de límites normales.`,
  },
  {
    name: 'Test Función Endotelial',
    content: `Estudio de función endotelial de la arteria braquial,  realizado con paciente en posición de decúbito dorsal, con reposo de 5 minutos, con ayuda de manguito de presión durante 5 minutos.

Complejo íntima media: 
Diámetro de la arteria braquial en estado basal:   mm
Diámetro de la arteria braquial en estado basal post-isquemia: mm

Flujo en estado basal:          cm/seg.  IR:         trifásico.
Post isquemia:           cm/seg,  IR:      con diástole (monofásico).

CONCLUSION:
Adecuada respuesta del endotelio a la prueba de disfunción endotelial.`,
  },
  {
    name: 'Eco Doppler Sustancia Nigra',
    content: `Adecuada ventana para la exploración del tronco cerebral.
Se observa -------- ecogenicidad de la sustancia nigra de ambos lados
Area derecha: 
Area izquierda: `,
  },
  {
    name: 'Ecodoppler TSA (Vasos de Cuello)',
    content: `EJES CAROTIDEOS: 
Flujo laminar de velocidad normal en ambas carótidas primitivas, internas y externas. Arterias oftálmicas con flujo anterógrado. 
Complejo íntima media en carótida primitiva derecha:  mm 
Complejo íntima media en carótida primitiva izquierda:  mm 
No se observan placas de ateroma.

ARTERIAS VERTEBRALES: 
Visualizadas en origen y segmentos V1 y V2 con flujo de dirección y velocidad normales. 

ARTERIAS SUBCLAVIAS: 
Flujo de velocidad normal en ambos vasos.

CONCLUSIONES: 
Vasos con morfología, endotelio y características hemodinámicas normales.`,
  },
];
