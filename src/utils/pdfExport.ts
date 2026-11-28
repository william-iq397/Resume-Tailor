import { jsPDF } from 'jspdf';
import { getAccentMeta } from '../data/presets';
import type {
  CandidateCertificatesMap,
  CandidateProfile,
  DocumentTemplateConfig,
  TailoredCoverLetter,
  TailoredCv,
} from '../types/ausbildung';
import { getUploadedAnlagenLabels } from './certificateStorage';

function sanitizePdfText(text: string): string {
  return (text || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ');
}

function slugify(value: string): string {
  return (
    (value || 'Ausbildung')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ausbildung'
  );
}

async function loadImageAsJpegDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load failed'));
      el.src = url;
    });

    const targetRatio = 4 / 5;
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return null;

    let cropW = srcW;
    let cropH = srcH;
    let cropX = 0;
    let cropY = 0;

    if (srcW / srcH > targetRatio) {
      cropW = srcH * targetRatio;
      cropX = (srcW - cropW) / 2;
    } else {
      cropH = srcW / targetRatio;
      cropY = Math.max(0, (srcH - cropH) * 0.25);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}

/**
 * Renders a 100% single-column, top-to-bottom linear reading-order PDF
 * so all Applicant Tracking Systems (Personio, SAP, Workday, Stepstone, Indeed)
 * parse every section, contact field, date, and keyword in exact order.
 */
function renderCvIntoDoc(
  doc: jsPDF,
  cv: TailoredCv,
  profile: CandidateProfile,
  config: DocumentTemplateConfig,
  photoDataUrl: string | null,
  certificates?: CandidateCertificatesMap
) {
  const accent = getAccentMeta(config.accent);
  const [ar, ag, ab] = accent.rgb;
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 20;
  const contentW = pageWidth - marginX * 2;

  const isEuropass = config.templateId === 'europass_ats';
  const isBauhaus = config.templateId === 'minimalist_bauhaus';

  let y = 16;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  // Top visual stripe for Europass & Minimalist ATS
  if (isEuropass || isBauhaus) {
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 0, pageWidth, isEuropass ? 3.5 : 2.5, 'F');
    y = 15;
  }

  // Optional Bewerbungsfoto placed top-right while all text flows linearly on the left
  const hasPhoto = config.showPhoto && Boolean(photoDataUrl);
  const headerTextW = hasPhoto ? contentW - 34 : contentW;

  if (hasPhoto && photoDataUrl) {
    doc.addImage(photoDataUrl, 'JPEG', pageWidth - marginX - 28, y, 28, 35);
  }

  // Europass / Document Header Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(ar, ag, ab);
  doc.text(isEuropass ? 'EUROPASS LEBENSLAUF' : 'LEBENSLAUF', marginX, y);
  y += 6;

  // Candidate Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(profile.fullName || 'Lebenslauf'), marginX, y);
  y += 6;

  // Target Role / Headline (ATS Title Match)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(ar, ag, ab);
  const headlineLines = doc.splitTextToSize(sanitizePdfText(cv.headline), headerTextW);
  doc.text(headlineLines, marginX, y);
  y += headlineLines.length * 4.6 + 3;

  // Explicitly labeled single-line contact fields (optimal for ATS extraction)
  const labeledContacts = [
    profile.streetAddress || profile.postalCity
      ? `Adresse: ${[profile.streetAddress, profile.postalCity].filter(Boolean).join(', ')}`
      : '',
    profile.phone ? `Telefon: ${profile.phone}` : '',
    profile.email ? `E-Mail: ${profile.email}` : '',
    profile.linkedInOrPortfolio ? `Portfolio / Web: ${profile.linkedInOrPortfolio}` : '',
    config.showPersonalMeta && profile.birthInfo ? `Geburtsdatum/-ort: ${profile.birthInfo}` : '',
    config.showPersonalMeta && profile.nationality
      ? `Staatsangehörigkeit: ${profile.nationality}`
      : '',
    config.showPersonalMeta && profile.availability
      ? `Verfügbarkeit: ${profile.availability}`
      : '',
  ].filter(Boolean);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);

  for (const field of labeledContacts) {
    const wrapped = doc.splitTextToSize(sanitizePdfText(field), headerTextW);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 4.1;
  }

  if (hasPhoto) {
    y = Math.max(y + 2, 53);
  } else {
    y += 3;
  }

  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(isEuropass ? 0.6 : 0.4);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  const drawSectionHeading = (title: string) => {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(ar, ag, ab);
    doc.text(title, marginX, y);
    y += 2;
    doc.setDrawColor(215, 222, 232);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5.2;
  };

  // 1. Kurzprofil
  if (cv.profileStatement) {
    drawSectionHeading(isEuropass ? 'PERSÖNLICHES PROFIL' : 'KURZPROFIL');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.6);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(sanitizePdfText(cv.profileStatement), contentW);
    doc.text(lines, marginX, y);
    y += lines.length * 4.5 + 6;
  }

  // 2. Berufserfahrung & Praktika (linear top-to-bottom per entry)
  if (cv.experience.length > 0) {
    drawSectionHeading(isEuropass ? 'BERUFSERFAHRUNG & PRAKTIKA' : 'PRAXISERFAHRUNG & PRAKTIKA');
    for (const exp of cv.experience) {
      ensureSpace(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const roleLines = doc.splitTextToSize(sanitizePdfText(exp.role), contentW - 42);
      doc.text(roleLines, marginX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(100, 116, 139);
      doc.text(sanitizePdfText(exp.period), pageWidth - marginX, y, { align: 'right' });

      y += roleLines.length * 4.3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(
        sanitizePdfText([exp.organization, exp.location].filter(Boolean).join(' | ')),
        marginX,
        y
      );
      y += 4.6;

      doc.setFontSize(9.4);
      doc.setTextColor(30, 41, 59);
      for (const bullet of exp.bullets) {
        const bLines = doc.splitTextToSize(sanitizePdfText(`- ${bullet}`), contentW - 3);
        ensureSpace(bLines.length * 4.3 + 2);
        doc.text(bLines, marginX + 2, y);
        y += bLines.length * 4.3 + 1;
      }
      y += 3.5;
    }
    y += 2;
  }

  // 3. Schul- und Berufsbildung
  if (cv.education.length > 0) {
    drawSectionHeading(isEuropass ? 'SCHUL- UND BERUFSBILDUNG' : 'SCHULBILDUNG');
    for (const edu of cv.education) {
      ensureSpace(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      const degLines = doc.splitTextToSize(sanitizePdfText(edu.degree), contentW - 42);
      doc.text(degLines, marginX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(100, 116, 139);
      doc.text(sanitizePdfText(edu.period), pageWidth - marginX, y, { align: 'right' });

      y += degLines.length * 4.3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(
        sanitizePdfText([edu.institution, edu.location].filter(Boolean).join(' | ')),
        marginX,
        y
      );
      y += 4.5;

      if (edu.details) {
        doc.setFontSize(9.4);
        doc.setTextColor(30, 41, 59);
        const detLines = doc.splitTextToSize(sanitizePdfText(edu.details), contentW);
        doc.text(detLines, marginX, y);
        y += detLines.length * 4.3;
      }
      y += 3.5;
    }
    y += 2;
  }

  // 4. Persönliche Fähigkeiten: Sprachen (CEFR) + Kompetenzen
  if (cv.languages.length > 0 || cv.skills.length > 0) {
    drawSectionHeading(isEuropass ? 'PERSÖNLICHE FÄHIGKEITEN & SPRACHEN' : 'KENNTNISSE & SPRACHEN');

    if (cv.languages.length > 0) {
      for (const lang of cv.languages) {
        ensureSpace(7);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.3);
        doc.setTextColor(15, 23, 42);
        const lineText = `${sanitizePdfText(lang.language)}: `;
        doc.text(lineText, marginX, y);
        const labelW = doc.getTextWidth(lineText);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(sanitizePdfText(lang.level), marginX + labelW, y);
        y += 4.8;
      }
      y += 2;
    }

    for (const group of cv.skills) {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.2);
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizePdfText(`${group.category}:`), marginX, y);
      y += 4.2;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(51, 65, 85);
      const skillLines = doc.splitTextToSize(sanitizePdfText(group.items.join(', ')), contentW);
      doc.text(skillLines, marginX, y);
      y += skillLines.length * 4.3 + 2.5;
    }
    y += 2;
  }

  // 5. Interessen
  if (cv.interests) {
    drawSectionHeading('INTERESSEN & ENGAGEMENT');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.3);
    doc.setTextColor(51, 65, 85);
    const intLines = doc.splitTextToSize(sanitizePdfText(cv.interests), contentW);
    doc.text(intLines, marginX, y);
    y += intLines.length * 4.5 + 4;
  }

  // 6. Anlagen (ONLY included if candidate actually uploaded certificates)
  const anlagenLabels = certificates ? getUploadedAnlagenLabels(certificates) : [];
  if (anlagenLabels.length > 0) {
    drawSectionHeading('ANLAGEN');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.3);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(anlagenLabels.join(', ')), marginX, y);
  }
}

function renderCoverLetterIntoDoc(
  doc: jsPDF,
  letter: TailoredCoverLetter,
  config: DocumentTemplateConfig
) {
  const accent = getAccentMeta(config.accent);
  const [ar, ag, ab] = accent.rgb;
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 25;
  const contentW = pageWidth - marginX - 20;

  const isEuropass = config.templateId === 'europass_ats';
  const isBauhaus = config.templateId === 'minimalist_bauhaus';

  if (isEuropass || isBauhaus) {
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 0, pageWidth, isEuropass ? 3.5 : 2.5, 'F');
  }

  let y = 20;

  if (isEuropass) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(ar, ag, ab);
    doc.text('EUROPASS MOTIVATIONSSCHREIBEN', marginX, y);
    y += 7;
  }

  // Sender block (linear top-to-bottom for ATS safety)
  const senderLines = (letter.senderBlock || '')
    .split('\n')
    .map((s) => sanitizePdfText(s.trim()))
    .filter(Boolean);

  if (senderLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(senderLines[0], marginX, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    for (const line of senderLines.slice(1)) {
      doc.text(line, marginX, y);
      y += 4.2;
    }
    y += 6;
  }

  // Recipient block
  const recipientLines = (letter.recipientBlock || '')
    .split('\n')
    .map((s) => sanitizePdfText(s.trim()))
    .filter(Boolean);

  if (recipientLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    for (const line of recipientLines) {
      doc.text(line, marginX, y);
      y += 4.6;
    }
    y += 6;
  }

  // Date & Place
  if (letter.datePlaceLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(letter.datePlaceLine), pageWidth - 20, y, { align: 'right' });
    y += 10;
  }

  // Subject line (Betreff)
  if (letter.subjectLine) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(ar, ag, ab);
    const subjLines = doc.splitTextToSize(sanitizePdfText(letter.subjectLine), contentW);
    doc.text(subjLines, marginX, y);
    y += subjLines.length * 5.2 + 8;
  }

  // Salutation
  if (letter.salutation) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(letter.salutation), marginX, y);
    y += 7;
  }

  // Body Paragraphs
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  for (const para of letter.paragraphs) {
    const wrapped = doc.splitTextToSize(sanitizePdfText(para), contentW);
    if (y + wrapped.length * 4.8 > pageHeight - 25) {
      doc.addPage();
      y = 24;
    }
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 4.8 + 4.5;
  }

  // Closing & signature
  y += 4;
  if (y + 20 > pageHeight - 16) {
    doc.addPage();
    y = 24;
  }
  if (letter.closing) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(letter.closing), marginX, y);
    y += 12;
  }
  if (letter.signatureName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(letter.signatureName), marginX, y);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function exportCvToPdf(
  cv: TailoredCv,
  profile: CandidateProfile,
  config: DocumentTemplateConfig,
  companyName: string,
  certificates?: CandidateCertificatesMap
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const photoDataUrl = config.showPhoto ? await loadImageAsJpegDataUrl(profile.photoUrl) : null;
  renderCvIntoDoc(doc, cv, profile, config, photoDataUrl, certificates);
  doc.save(`Europass-Lebenslauf-${slugify(companyName)}.pdf`);
}

export async function exportCoverLetterToPdf(
  letter: TailoredCoverLetter,
  config: DocumentTemplateConfig,
  companyName: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderCoverLetterIntoDoc(doc, letter, config);
  doc.save(`Anschreiben-${slugify(companyName)}.pdf`);
}

export async function exportCombinedPdf(
  cv: TailoredCv,
  letter: TailoredCoverLetter,
  profile: CandidateProfile,
  config: DocumentTemplateConfig,
  companyName: string,
  certificates?: CandidateCertificatesMap
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderCoverLetterIntoDoc(doc, letter, config);
  doc.addPage();
  const photoDataUrl = config.showPhoto ? await loadImageAsJpegDataUrl(profile.photoUrl) : null;
  renderCvIntoDoc(doc, cv, profile, config, photoDataUrl, certificates);
  doc.save(`Bewerbung-Europass-${slugify(companyName)}.pdf`);
}

export async function generateCvPdfBase64(
  cv: TailoredCv,
  profile: CandidateProfile,
  config: DocumentTemplateConfig,
  companyName: string,
  certificates?: CandidateCertificatesMap
): Promise<{ filename: string; mimeType: string; contentBase64: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const photoDataUrl = config.showPhoto ? await loadImageAsJpegDataUrl(profile.photoUrl) : null;
  renderCvIntoDoc(doc, cv, profile, config, photoDataUrl, certificates);
  const contentBase64 = arrayBufferToBase64(doc.output('arraybuffer'));
  return {
    filename: `Lebenslauf-${slugify(companyName)}.pdf`,
    mimeType: 'application/pdf',
    contentBase64,
  };
}

export async function generateCoverLetterPdfBase64(
  letter: TailoredCoverLetter,
  config: DocumentTemplateConfig,
  companyName: string
): Promise<{ filename: string; mimeType: string; contentBase64: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderCoverLetterIntoDoc(doc, letter, config);
  const contentBase64 = arrayBufferToBase64(doc.output('arraybuffer'));
  return {
    filename: `Anschreiben-${slugify(companyName)}.pdf`,
    mimeType: 'application/pdf',
    contentBase64,
  };
}
