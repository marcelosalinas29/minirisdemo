import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, Phone, Calendar, FileText, ImagePlus, Send, Download, Trash2, ChevronDown, Edit2, Save, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { calcularEdad, calcularEdadDetallada, formatEdad } from '@/types/medical';
import AppLayout from '@/components/AppLayout';
import { useClinicStore } from '@/store/useClinicStore';
import { useAuth } from '@/contexts/AuthContext';
import { STATUS_LABELS, type StudyStatus, formatStudyType } from '@/types/medical';
import TemplateSelector from '@/components/TemplateSelector';
import StudyTypeSelector from '@/components/StudyTypeSelector';
import RichTextEditor from '@/components/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import clinicLogo from '@/assets/clinic-logo.png';
import signatureMarceloSalinas from '@/assets/signatures/marcelosalinas29.png';
import signatureMarimar from '@/assets/signatures/marimarschreiber.png';
import { supabase } from '@/integrations/supabase/client';

const SIGNATURE_IMAGES: Record<string, string> = {
  'marcelosalinas29@gmail.com': signatureMarceloSalinas,
  'marimarschreiber@gmail.com': signatureMarimar,
};

const statusClass: Record<StudyStatus, string> = {
  'pending': 'status-badge-pending',
  'in-study': 'status-badge-in-study',
  'reported': 'status-badge-reported',
  'sent': 'status-badge-sent',
};

/** Convert HTML to plain text preserving paragraph breaks */
function htmlToPlainText(html: string): string {
  // Replace closing block tags with newlines before stripping
  let text = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n');
  // Strip remaining HTML tags
  const div = document.createElement('div');
  div.innerHTML = text;
  text = div.textContent || div.innerText || '';
  // Clean up multiple newlines but preserve paragraph spacing
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

const AppointmentPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const appointment = useClinicStore((s) => s.appointments.find((a) => a.id === (id || '')));
  const fetchAppointmentDetail = useClinicStore((s) => s.fetchAppointmentDetail);
  const updateAppointmentStatus = useClinicStore((s) => s.updateAppointmentStatus);
  const updateAppointmentReport = useClinicStore((s) => s.updateAppointmentReport);
  const updateAppointmentStudyType = useClinicStore((s) => s.updateAppointmentStudyType);
  const updatePatient = useClinicStore((s) => s.updatePatient);
  const addImagesToAppointment = useClinicStore((s) => s.addImagesToAppointment);
  const addStorageImagesToAppointment = useClinicStore((s) => s.addStorageImagesToAppointment);
  const removeImageFromAppointment = useClinicStore((s) => s.removeImageFromAppointment);
  const removeStorageImage = useClinicStore((s) => s.removeStorageImage);
  const getPatientAppointments = useClinicStore((s) => s.getPatientAppointments);
  const getAppointment = useClinicStore((s) => s.getAppointment);
  const { profile, isSecretary, isViewer, user } = useAuth();
  const isReadOnly = isSecretary || isViewer;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showStudySelector, setShowStudySelector] = useState(false);
  const isReportEmpty = (r: string) => !r || r === '<p></p>' || r.replace(/<[^>]*>/g, '').trim() === '';
  const [isEditing, setIsEditing] = useState(!appointment?.report || isReportEmpty(appointment?.report || ''));
  const [report, setReport] = useState(appointment?.report || '');
  const [reportLoadedFromDb, setReportLoadedFromDb] = useState(false);
  const [detailLoading, setDetailLoading] = useState(true);
  const [editingPatient, setEditingPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({
    name: '',
    dni: '',
    phone: '',
    obraSocial: '',
    fechaNacimiento: '',
  });

  useEffect(() => {
    if (appointment) {
      setPatientForm({
        name: appointment.patient.name,
        dni: appointment.patient.dni || '',
        phone: appointment.patient.phone,
        obraSocial: appointment.patient.obraSocial || '',
        fechaNacimiento: appointment.patient.fechaNacimiento || '',
      });
    }
  }, [appointment?.patient.id]);

  useEffect(() => {
    let cancelled = false;

    if (id) {
      setDetailLoading(true);
      setReportLoadedFromDb(false);
      fetchAppointmentDetail(id)
        .catch((error) => {
          console.error('Error loading appointment detail:', error);
        })
        .finally(() => {
          if (!cancelled) {
            setDetailLoading(false);
          }
        });
    } else {
      setDetailLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (appointment && !reportLoadedFromDb && appointment.report && !isReportEmpty(appointment.report)) {
      setReport(appointment.report);
      setReportLoadedFromDb(true);
      setIsEditing(false);
    }
  }, [appointment?.report, reportLoadedFromDb]);

  const handleSaveReport = useCallback(async () => {
    if (!id) return;
    if (isReportEmpty(report)) {
      console.warn('handleSaveReport: report is empty, skipping save');
      return;
    }
    // Store who reported (doctor's user_id)
    const reportedBy = !isReadOnly && user ? user.id : undefined;
    await updateAppointmentReport(id, report, reportedBy);
    setReportLoadedFromDb(true);
    if (appointment?.status === 'pending' || appointment?.status === 'in-study') {
      await updateAppointmentStatus(id, 'reported');
    }
    toast.success('Informe guardado');
  }, [id, report, appointment?.status, isReadOnly, user, updateAppointmentReport, updateAppointmentStatus]);

  const handleSavePatient = async () => {
    if (!appointment) return;
    try {
      await updatePatient(appointment.patient.id, {
        name: patientForm.name.toUpperCase(),
        dni: patientForm.dni,
        phone: patientForm.phone,
        obraSocial: patientForm.obraSocial.toUpperCase(),
        fechaNacimiento: patientForm.fechaNacimiento || undefined,
      });
      setEditingPatient(false);
      toast.success('Datos del paciente actualizados');
    } catch {
      toast.error('Error al actualizar los datos');
    }
  };

  const handleStatusChange = async (status: StudyStatus) => {
    if (!id) return;
    await updateAppointmentStatus(id, status);
    toast.success(`Estado actualizado a: ${STATUS_LABELS[status]}`);
  };

  const handleStudyTypeChange = async (studyType: string) => {
    if (!id) return;
    await updateAppointmentStudyType(id, studyType);
    toast.success('Tipo de estudio actualizado');
  };

  const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !id) return;
    toast.info('Subiendo imágenes...');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        const fileName = `${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('estudios_imagenes')
          .upload(fileName, compressed, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('estudios_imagenes').getPublicUrl(fileName);
        urls.push(urlData.publicUrl);
      }
      await addStorageImagesToAppointment(id, urls);
      toast.success(`${urls.length} imagen(es) cargada(s)`);
    } catch (err: any) {
      console.error('Error uploading images:', err);
      toast.error(`Error al subir imágenes: ${err?.message || 'Error desconocido'}`);
    }
  };

  const applyTemplate = (content: string) => {
    setReport(content);
    setIsEditing(true);
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // Only set crossOrigin for remote URLs, NOT for data URIs or blob URLs
      if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.error('Image load error:', src.substring(0, 100), e);
        reject(new Error(`No se pudo cargar imagen: ${src.substring(0, 80)}`));
      };
      img.src = src;
    });
  };

  const buildPdfDoc = async (qrDataUrl?: string): Promise<jsPDF> => {
    if (!appointment) throw new Error('No appointment');
    const currentAppointment = getAppointment(id || '') || appointment;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 25; // 2.5 cm lateral margins
    const contentWidth = pageWidth - margin * 2;

    const drawFooter = () => {
      const footerY = pageHeight - 18;

      // QR code (bottom-right, above footer line) — links to online report.
      // Layout: [QR] -> [caption text] -> [footer line]
      // Caption sits ABOVE the line so it never overlaps the footer text/line.
      if (qrDataUrl) {
        const qrSize = 18;
        const captionGap = 5; // space reserved for caption between QR and line
        const qrX = pageWidth - margin - qrSize;
        const qrY = footerY - 3 - captionGap - qrSize;
        try {
          doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          // Place caption ~1.5mm above the footer line (which is at footerY - 3)
          doc.text('Escaneá para ver online', qrX + qrSize / 2, footerY - 4.5, { align: 'center' });
        } catch {
          // ignore QR rendering errors
        }
      }

      doc.setDrawColor(37, 99, 135);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(37, 99, 135);
      doc.text('Rivadavia 465, reconquista Santa Fe', pageWidth / 2, footerY, { align: 'center' });
      doc.text('Tel.: 3482437948- WhatsApp: 3482244516', pageWidth / 2, footerY + 3.5, { align: 'center' });
      doc.text('www.dmrimagenes.com.ar', pageWidth / 2, footerY + 7, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    };

    // Reserve vertical space at the bottom of each page so content (text,
    // signature, QR) never overlaps the fixed footer. QR top now sits at
    // footerY - 3 - 5 - 18 = pageHeight - 44, so keep content above -46.
    const bottomLimit = pageHeight - 46;

    // ====== HEADER (logo + subtitle) ======
    try {
      const logoImg = await loadImage(clinicLogo);
      const logoHeight = 28;
      const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
      doc.addImage(clinicLogo, 'PNG', (pageWidth - logoWidth) / 2, 6, logoWidth, logoHeight);
    } catch {
      // Fallback text if logo fails to load
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 135);
      doc.text('DIAGNOSTICO', pageWidth / 2, 18, { align: 'center' });
      doc.setFontSize(16);
      doc.text('MEDICO RECONQUISTA', pageWidth / 2, 26, { align: 'center' });
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 135);
    doc.text('S E R V I C I O   D E   E C O G R A F I A   Y   D O P P L E R', pageWidth / 2, 36, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.setDrawColor(37, 99, 135);
    doc.setLineWidth(0.5);
    doc.line(margin, 39, pageWidth - margin, 39);

    // ====== PATIENT INFO ======
    let y = 47;
    const fontSize = 11;
    doc.setFontSize(fontSize);
    const valueX = margin + 30; // Fixed X position for all values

    const drawLabel = (label: string, x: number, yPos: number) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, x, yPos);
      const w = doc.getTextWidth(label);
      doc.setLineWidth(0.3);
      doc.setDrawColor(0, 0, 0);
      doc.line(x, yPos + 1, x + w, yPos + 1);
    };

    const drawValue = (value: string, x: number, yPos: number) => {
      doc.setFont('helvetica', 'bold');
      doc.text(value.toUpperCase(), x, yPos);
    };

    drawLabel('PACIENTE:', margin, y);
    drawValue(appointment.patient.name, valueX, y);

    y += 7;
    drawLabel('FECHA:', margin, y);
    // Parse date parts to avoid timezone offset (new Date('YYYY-MM-DD') is UTC, shifts day in AR)
    const [yy, mm, dd] = appointment.date.split('-').map(Number);
    const dateStr = format(new Date(yy, mm - 1, dd), "d 'de' MMMM yyyy", { locale: es });
    drawValue(dateStr, valueX, y);

    y += 7;
    drawLabel('EDAD:', margin, y);
    const ageText = (formatEdad(appointment.patient.fechaNacimiento, appointment.patient.age) || `${appointment.patient.age} AÑOS`).toUpperCase();
    drawValue(ageText, valueX, y);
    if (appointment.patient.dni) {
      const dniLabelX = valueX + doc.getTextWidth(ageText + '   ') + 10;
      drawLabel('DNI:', dniLabelX, y);
      drawValue(appointment.patient.dni, dniLabelX + 16, y);
    }

    y += 7;
    drawLabel('ESTUDIO:', margin, y);
    const studyText = formatStudyType(currentAppointment.studyType || appointment.studyType);
    const studyLines = doc.splitTextToSize(studyText, contentWidth - (valueX - margin));
    doc.setFont('helvetica', 'bold');
    doc.text(studyLines, valueX, y);
    y += studyLines.length * 5;

    y += 3;
    doc.setDrawColor(37, 99, 135);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    // ====== REPORT BODY with rich formatting ======
    y += 8;

    interface TextSegment { text: string; bold: boolean; italic: boolean; underline: boolean; }
    interface PdfParagraph { segments: TextSegment[]; lineHeight: number; align: 'left' | 'center' | 'right'; }

    const parseHtmlToPdfParagraphs = (html: string): PdfParagraph[] => {
      const container = document.createElement('div');
      container.innerHTML = html;
      const paragraphs: PdfParagraph[] = [];

      const extractSegments = (node: Node, style: { bold: boolean; italic: boolean; underline: boolean }): TextSegment[] => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (!text) return [];
          return [{ text, ...style }];
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return [];
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'br') return [{ text: '\n', ...style }];
        const newStyle = { ...style };
        if (tag === 'strong' || tag === 'b') newStyle.bold = true;
        if (tag === 'em' || tag === 'i') newStyle.italic = true;
        if (tag === 'u') newStyle.underline = true;
        if (el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 700) newStyle.bold = true;
        if (el.style.fontStyle === 'italic') newStyle.italic = true;
        if (el.style.textDecoration?.includes('underline')) newStyle.underline = true;
        const segs: TextSegment[] = [];
        for (const child of Array.from(el.childNodes)) {
          segs.push(...extractSegments(child, newStyle));
        }
        return segs;
      };

      const processBlock = (el: HTMLElement) => {
        const lh = parseFloat(el.style.lineHeight) || 1.6;
        const align = (el.style.textAlign || 'left') as 'left' | 'center' | 'right';
        const rawSegments = extractSegments(el, { bold: false, italic: false, underline: false });
        const subParas: TextSegment[][] = [[]];
        for (const seg of rawSegments) {
          if (seg.text.includes('\n')) {
            const parts = seg.text.split('\n');
            for (let i = 0; i < parts.length; i++) {
              if (i > 0) subParas.push([]);
              if (parts[i]) subParas[subParas.length - 1].push({ ...seg, text: parts[i] });
            }
          } else {
            subParas[subParas.length - 1].push(seg);
          }
        }
        for (const sub of subParas) {
          paragraphs.push({ segments: sub, lineHeight: lh, align });
        }
      };

      for (const child of Array.from(container.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === 'ul' || tag === 'ol') {
            el.querySelectorAll('li').forEach((li, idx) => {
              const bullet = tag === 'ol' ? `${idx + 1}. ` : '• ';
              const segs = extractSegments(li, { bold: false, italic: false, underline: false });
              segs.unshift({ text: bullet, bold: false, italic: false, underline: false });
              paragraphs.push({ segments: segs, lineHeight: parseFloat((li as HTMLElement).style.lineHeight) || 1.6, align: 'left' });
            });
          } else {
            processBlock(el);
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          const txt = child.textContent?.trim();
          if (txt) paragraphs.push({ segments: [{ text: txt, bold: false, italic: false, underline: false }], lineHeight: 1.6, align: 'left' });
        }
      }
      return paragraphs;
    };

    const renderPdfParagraphs = (paras: PdfParagraph[]) => {
      const baseLine = 5;
      // Paragraph spacing in mm — equivalent to ~1.2em at 10pt font
      const paragraphSpacing = 4.2;
      for (const para of paras) {
        if (para.segments.length === 0) {
          y += baseLine * (para.lineHeight / 1.6) * 0.6;
          continue;
        }
        const lineSpacing = baseLine * (para.lineHeight / 1.6);
        const fullText = para.segments.map(s => s.text).join('');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const wrappedLines = doc.splitTextToSize(fullText, contentWidth);
        let globalCharIdx = 0;

        for (const wLine of wrappedLines) {
          if (y > bottomLimit) { drawFooter(); doc.addPage(); y = 20; }

          // Calculate actual line width for alignment
          let calcWidth = 0;
          let tci = globalCharIdx, tsi = 0, tso = 0, tt = 0;
          for (let i = 0; i < para.segments.length; i++) {
            if (tt + para.segments[i].text.length > tci) { tsi = i; tso = tci - tt; break; }
            tt += para.segments[i].text.length;
          }
          let tlp = 0;
          while (tlp < wLine.length) {
            const seg = para.segments[tsi];
            if (!seg) break;
            const rl = Math.min(seg.text.length - tso, wLine.length - tlp);
            const rt = wLine.substring(tlp, tlp + rl);
            const fs = seg.bold && seg.italic ? 'bolditalic' : seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal';
            doc.setFont('helvetica', fs);
            calcWidth += doc.getTextWidth(rt);
            tlp += rl; tso += rl;
            if (tso >= seg.text.length) { tsi++; tso = 0; }
          }

          let xStart = margin;
          if (para.align === 'center') xStart = margin + (contentWidth - calcWidth) / 2;
          else if (para.align === 'right') xStart = margin + contentWidth - calcWidth;

          // Find starting segment
          let segIdx = 0, segOff = 0;
          tt = 0;
          for (let i = 0; i < para.segments.length; i++) {
            if (tt + para.segments[i].text.length > globalCharIdx) { segIdx = i; segOff = globalCharIdx - tt; break; }
            tt += para.segments[i].text.length;
          }

          let xPos = xStart, linePos = 0;
          while (linePos < wLine.length) {
            const seg = para.segments[segIdx];
            if (!seg) break;
            const runLen = Math.min(seg.text.length - segOff, wLine.length - linePos);
            const runText = wLine.substring(linePos, linePos + runLen);
            const fontStyle = seg.bold && seg.italic ? 'bolditalic' : seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal';
            doc.setFont('helvetica', fontStyle);
            doc.text(runText, xPos, y);
            const tw = doc.getTextWidth(runText);
            if (seg.underline) {
              doc.setLineWidth(0.3);
              doc.setDrawColor(0, 0, 0);
              doc.line(xPos, y + 1, xPos + tw, y + 1);
            }
            xPos += tw;
            linePos += runLen; segOff += runLen; globalCharIdx += runLen;
            if (segOff >= seg.text.length) { segIdx++; segOff = 0; }
          }
          y += lineSpacing;
        }
        // Add inter-paragraph spacing (margin-bottom: 1.2em equivalent)
        y += paragraphSpacing;
        if (y > bottomLimit) { drawFooter(); doc.addPage(); y = 20; }
      }
    };

    const pdfParagraphs = parseHtmlToPdfParagraphs(report || '<p>Sin informe</p>');
    renderPdfParagraphs(pdfParagraphs);

    // ====== SIGNATURE - right-aligned, below report ======
    y += 10;

    const signBlockWidth = 70;
    const signX = pageWidth - margin - signBlockWidth;

    // Determine which profile/email to use for signature
    // If secretary, use the doctor who reported (reported_by)
    let pdfProfile = profile;
    let pdfEmail = user?.email || '';

    if (isSecretary && currentAppointment.reportedBy) {
      // Fetch the doctor's profile (which now includes email)
      const { data: doctorProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', currentAppointment.reportedBy)
        .single();
      if (doctorProfile) {
        pdfProfile = doctorProfile as any;
        pdfEmail = (doctorProfile as any).email || '';
      }
    }

    const signatureImgSrc = SIGNATURE_IMAGES[pdfEmail];

    // Precompute signature image dimensions to know full block height,
    // so we can move the whole block to the next page if it doesn't fit
    // above the fixed footer.
    let sigW = 0;
    let sigH = 0;
    if (signatureImgSrc) {
      try {
        const sigImg = await loadImage(signatureImgSrc);
        const sigRatio = sigImg.naturalWidth / sigImg.naturalHeight;
        sigW = 40;
        sigH = sigW / sigRatio;
        if (sigH > 25) { sigH = 25; sigW = sigH * sigRatio; }
      } catch { sigW = 0; sigH = 0; }
    }

    const specialtyLinesPre = (pdfProfile?.specialty || 'Médico especialista en\nDiagnóstico por Imágenes').split('\n');
    // Total signature block height: image + 2 gap + line + 12 (to specialty start)
    // + n*4 specialty + 4 license padding.
    const signatureBlockHeight = sigH + (sigH > 0 ? 2 : 0) + 12 + specialtyLinesPre.length * 4 + 4;

    if (y + signatureBlockHeight > bottomLimit) {
      drawFooter();
      doc.addPage();
      y = 20;
    }

    if (signatureImgSrc && sigH > 0) {
      doc.addImage(signatureImgSrc, 'PNG', signX + (signBlockWidth - sigW) / 2, y, sigW, sigH);
      y += sigH + 2;
    }

    doc.setDrawColor(37, 99, 135);
    doc.setLineWidth(0.4);
    doc.line(signX, y, signX + signBlockWidth, y);

    const sigText = pdfProfile?.signature_text || pdfProfile?.full_name || 'Dr. Salinas A. Marcelo';
    doc.setFontSize(11);
    doc.setFont('times', 'bolditalic');
    doc.text(sigText, signX + signBlockWidth / 2, y + 6, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const specialtyLines = (pdfProfile?.specialty || 'Médico especialista en\nDiagnóstico por Imágenes').split('\n');
    specialtyLines.forEach((line, idx) => {
      doc.text(line, signX + signBlockWidth / 2, y + 12 + idx * 4, { align: 'center' });
    });

    doc.setFontSize(7);
    const licenseY = y + 12 + specialtyLines.length * 4;
    doc.text(pdfProfile?.license_numbers || 'MN 134217  MP 7298  Fº54  Lº4to', signX + signBlockWidth / 2, licenseY + 2, { align: 'center' });

    drawFooter();

    // ====== IMAGES (hybrid: Storage URLs + legacy base64) ======
    const currentApp = getAppointment(id || '');
    const allImages = [
      ...(currentApp?.imageUrls || []),
      ...(currentApp?.images || []),
    ];
    if (allImages.length > 0) {
      const maxImgW = (contentWidth - 8) / 2;
      const maxImgH = 80;
      let imgIndex = 0;

      while (imgIndex < allImages.length) {
        doc.addPage();
        let iy = 20;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Imágenes del Estudio', margin, iy);
        iy += 10;

        let countOnPage = 0;
        const imagesPerPage = 6;

        while (imgIndex < allImages.length && countOnPage < imagesPerPage) {
          const col = countOnPage % 2;

          try {
            const imgSrc = allImages[imgIndex];
            const imgEl = await loadImage(imgSrc);
            const imgRatio = imgEl.naturalWidth / imgEl.naturalHeight;

            let drawW = maxImgW;
            let drawH = drawW / imgRatio;
            if (drawH > maxImgH) {
              drawH = maxImgH;
              drawW = drawH * imgRatio;
            }

            const x = margin + col * (maxImgW + 8) + (maxImgW - drawW) / 2;
            doc.addImage(imgSrc, 'JPEG', x, iy, drawW, drawH);

            imgIndex++;
            countOnPage++;
            if (col === 1 || imgIndex >= allImages.length || countOnPage >= imagesPerPage) {
              iy += maxImgH + 5;
            }
          } catch {
            imgIndex++;
            countOnPage++;
          }
        }

        drawFooter();
      }
    }

    return doc;
  };

  // Builds PDF with embedded QR, uploads it to Storage under a deterministic
  // permanent path, and returns both the doc and the public URL.
  const buildAndPublishPdf = async (): Promise<{ doc: jsPDF; publicUrl: string }> => {
    if (!appointment) throw new Error('No appointment');
    // Deterministic, permanent path per appointment (overwritten on each save)
    const storagePath = `informe_${appointment.id}.pdf`;
    const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Generate QR pointing to the public URL
    const qrDataUrl = await QRCode.toDataURL(publicUrl, {
      margin: 1,
      width: 400,
      errorCorrectionLevel: 'M',
      color: { dark: '#196B8A', light: '#FFFFFF' },
    });

    const doc = await buildPdfDoc(qrDataUrl);
    const pdfBlob = doc.output('blob');

    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    return { doc, publicUrl };
  };

  const generatePDF = async () => {
    if (!appointment) return;
    try {
      await handleSaveReport();
      const { doc } = await buildAndPublishPdf();
      doc.save(`Informe_${appointment.patient.name.replace(/\s/g, '_')}_${appointment.date}.pdf`);
      toast.success('PDF generado exitosamente');
    } catch (err: any) {
      console.error('Error al generar PDF:', err?.message || err, err?.stack || '');
      toast.error(`Error al crear el PDF: ${err?.message || 'Error desconocido'}`);
    }
  };

  const sendWhatsApp = async () => {
    if (!appointment || !id) return;

    // Open WhatsApp window IMMEDIATELY (synchronous) to avoid popup blocker
    const waWindow = window.open('about:blank', '_blank');

    await handleSaveReport();
    toast.info('Generando PDF...');

    try {
      const { publicUrl } = await buildAndPublishPdf();

      // Normalize Argentine phone: +54 9 [area][number]
      let phone = appointment.patient.phone.replace(/[\s\-\(\)\.\+]/g, '');
      if (phone.startsWith('549')) {
        // Already correct: 549XXXXXXXXXX
      } else if (phone.startsWith('54')) {
        phone = '549' + phone.substring(2);
      } else {
        // Local: remove leading 0, then remove 15 after area code
        if (phone.startsWith('0')) phone = phone.substring(1);
        phone = phone.replace(/^(\d{2,4})15(\d{6,})$/, '$1$2');
        phone = '549' + phone;
      }
      phone = phone.replace(/\D/g, '');

      const [wy, wm, wd] = appointment.date.split('-').map(Number);
      const whatsappDate = format(new Date(wy, wm - 1, wd), "d/MM/yyyy");
      const message = encodeURIComponent(
        `*ECOGRAFÍA Y DOPPLER*\n*Diagnóstico Médico Reconquista*\n\nPaciente: ${appointment.patient.name}\nEstudio: ${formatStudyType(appointment.studyType)}\nFecha: ${whatsappDate}\n\n📄 *Descargá tu informe PDF aquí:*\n${publicUrl}`
      );

      const waUrl = `https://wa.me/${phone}?text=${message}`;

      // Navigate the pre-opened window to WhatsApp URL
      if (waWindow && !waWindow.closed) {
        waWindow.location.href = waUrl;
      } else {
        // Fallback: navigate current tab if popup was still blocked
        window.location.href = waUrl;
      }

      await updateAppointmentStatus(id, 'sent');
      toast.success('WhatsApp abierto con enlace al PDF');
    } catch (err: any) {
      console.error('Error al enviar WhatsApp:', err?.message || err, err?.stack || '');
      if (waWindow && !waWindow.closed) {
        waWindow.close();
      }
      toast.error(`Error al generar o enviar PDF: ${err?.message || 'Error desconocido'}`);
    }
  };

  if (detailLoading) {
    return (
      <AppLayout title="Cargando...">
        <div className="p-8 text-center text-muted-foreground">
          <p>Cargando cita...</p>
        </div>
      </AppLayout>
    );
  }

  if (!appointment) {
    return (
      <AppLayout title="No encontrado">
        <div className="p-8 text-center text-muted-foreground">
          <p>Cita no encontrada</p>
          <Button variant="outline" onClick={() => navigate('/')} className="mt-4">
            Volver a citas
          </Button>
        </div>
      </AppLayout>
    );
  }

  const currentAppointment = getAppointment(id || '') || appointment;

  return (
    <AppLayout title={appointment.patient.name}>
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Patient Info Card */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {editingPatient ? (
                <Input
                  value={patientForm.name}
                  onChange={(e) => setPatientForm(f => ({ ...f, name: e.target.value.toUpperCase() }))}
                  className="uppercase font-semibold text-lg h-8"
                  placeholder="NOMBRE Y APELLIDO"
                />
              ) : (
                <span className="font-semibold text-lg">{appointment.patient.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={statusClass[currentAppointment.status]}>
                {STATUS_LABELS[currentAppointment.status]}
              </Badge>
              {editingPatient ? (
                <Button variant="ghost" size="sm" onClick={handleSavePatient}>
                  <Save className="w-4 h-4 text-primary" />
                </Button>
              ) : !isReadOnly ? (
                <Button variant="ghost" size="sm" onClick={() => setEditingPatient(true)}>
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </Button>
              ) : null}
            </div>
          </div>

          {editingPatient ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <label className="text-xs text-muted-foreground">DNI</label>
                <Input value={patientForm.dni} onChange={(e) => setPatientForm(f => ({ ...f, dni: e.target.value }))} className="h-8" placeholder="DNI" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fecha Nac.</label>
                <Input type="date" value={patientForm.fechaNacimiento} onChange={(e) => setPatientForm(f => ({ ...f, fechaNacimiento: e.target.value }))} className="h-8" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Teléfono</label>
                <Input value={patientForm.phone} onChange={(e) => setPatientForm(f => ({ ...f, phone: e.target.value }))} className="h-8" placeholder="Teléfono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Obra Social</label>
                <Input value={patientForm.obraSocial} onChange={(e) => setPatientForm(f => ({ ...f, obraSocial: e.target.value.toUpperCase() }))} className="uppercase h-8" placeholder="Obra Social" />
              </div>
              <div className="col-span-2">
                {(() => {
                  const e = patientForm.fechaNacimiento
                    ? calcularEdadDetallada(patientForm.fechaNacimiento)
                    : { value: appointment.patient.age, unit: 'años' as const };
                  return <label className="text-xs text-muted-foreground">Edad calculada: <span className="font-bold text-foreground">{e.value}</span> {e.unit}</label>;
                })()}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              {appointment.patient.dni && <span>DNI: {appointment.patient.dni}</span>}
              {(() => {
                const e = appointment.patient.fechaNacimiento
                  ? calcularEdadDetallada(appointment.patient.fechaNacimiento)
                  : { value: appointment.patient.age, unit: 'años' as const };
                return <span>Edad: <span className="font-bold text-foreground">{e.value}</span> {e.unit}</span>;
              })()}
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{appointment.patient.phone}</span>
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span className="uppercase font-bold text-xs">{formatStudyType(currentAppointment.studyType)}</span>
                {!isReadOnly && (
                  <button onClick={() => setShowStudySelector(true)} className="ml-1 text-primary hover:text-primary/80">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{(() => { const [y, m, d] = appointment.date.split('-').map(Number); return format(new Date(y, m - 1, d), "d/MM/yyyy"); })()}</span>
              {appointment.patient.obraSocial && (
                <span>Obra Social: {appointment.patient.obraSocial}</span>
              )}
            </div>
          )}

          <StudyTypeSelector
            open={showStudySelector}
            onOpenChange={setShowStudySelector}
            onApply={handleStudyTypeChange}
            currentValue={currentAppointment.studyType}
          />

          <Select value={currentAppointment.status} onValueChange={(v) => handleStatusChange(v as StudyStatus)} disabled={isReadOnly}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in-study">En estudio</SelectItem>
              <SelectItem value="reported">Reportado</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Report Section - Rich Text Editor */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Informe {isReadOnly && <span className="text-xs text-muted-foreground">(solo lectura)</span>}
            </h2>
            <div className="flex gap-2">
              {!isReadOnly && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
                    Plantillas <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                  {report && !isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      Editar
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <TemplateSelector
            open={showTemplates}
            onOpenChange={setShowTemplates}
            onApply={applyTemplate}
            currentReport={report}
          />

          {isEditing || !report ? (
            <>
              <RichTextEditor
                content={report}
                onChange={setReport}
                disabled={isReadOnly}
                placeholder="Escriba el informe aquí..."
              />
              {!isReadOnly && (
                <Button onClick={async () => { await handleSaveReport(); setIsEditing(false); }} className="w-full btn-action-primary">
                  Guardar Informe
                </Button>
              )}
            </>
          ) : (
            <div
              className="bg-muted/50 rounded-lg p-4 prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: report }}
            />
          )}
        </div>

        {/* Images Section */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-primary" />
            Imágenes {isReadOnly && <span className="text-xs text-muted-foreground">(solo lectura)</span>}
          </h2>

          {!isReadOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/bmp,image/gif,image/webp,image/tiff"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                <ImagePlus className="w-4 h-4 mr-2" />
                Cargar Imágenes
              </Button>
            </>
          )}

          {/* Storage images (new) */}
          {currentAppointment.imageUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {currentAppointment.imageUrls.map((url, i) => (
                <div key={`url-${i}`} className="relative group rounded-lg overflow-hidden border border-border">
                  <img src={url} alt={`Ecografía ${i + 1}`} className="w-full h-32 object-cover" crossOrigin="anonymous" />
                  {!isReadOnly && (
                    <button
                      onClick={async () => { if (id) await removeStorageImage(id, i); }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legacy base64 images */}
          {currentAppointment.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {currentAppointment.images.map((img, i) => (
                <div key={`legacy-${i}`} className="relative group rounded-lg overflow-hidden border border-border">
                  <img src={img} alt={`Ecografía legacy ${i + 1}`} className="w-full h-32 object-cover" />
                  {!isReadOnly && (
                    <button
                      onClick={async () => { if (id) await removeImageFromAppointment(id, i); }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pb-4">
          <Button onClick={generatePDF} className="w-full btn-action-primary" size="lg">
            <Download className="w-4 h-4 mr-2" />
            Generar Informe PDF
          </Button>
          <Button onClick={sendWhatsApp} className="w-full btn-whatsapp" size="lg">
            <Send className="w-4 h-4 mr-2" />
            Enviar por WhatsApp
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AppointmentPage;
