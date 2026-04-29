import { NextRequest, NextResponse } from 'next/server';
import { getTicket } from '../../../lib/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do ingresso ausente' }, { status: 400 });
    }

    const ticket = await getTicket(id);

    if (!ticket) {
      return NextResponse.json({ error: 'Ingresso não encontrado' }, { status: 404 });
    }

    // Criar o documento PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 600]);
    const { width, height } = page.getSize();

    // Fontes
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Cores (Rosa Chá com Prosa)
    const primaryColor = rgb(0.78, 0.48, 0.62); // #C87A9F
    const secondaryColor = rgb(0.85, 0.55, 0.69); // #D98BB0
    const textColor = rgb(0.2, 0.2, 0.2);

    // Desenhar fundo do cabeçalho
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: primaryColor,
    });

    // Título
    page.drawText('CHÁ COM PROSA', {
      x: 30,
      y: height - 60,
      size: 24,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText('Edição 2026 - Mulheres com Propósito', {
      x: 30,
      y: height - 85,
      size: 12,
      font: fontRegular,
      color: rgb(0.95, 0.95, 0.95),
    });

    // Linha divisória
    page.drawLine({
      start: { x: 30, y: height - 150 },
      end: { x: width - 30, y: height - 150 },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Nome da Participante
    page.drawText('PARTICIPANTE CONFIRMADA', {
      x: 30,
      y: height - 180,
      size: 10,
      font: fontBold,
      color: primaryColor,
    });

    page.drawText(ticket.name.toUpperCase(), {
      x: 30,
      y: height - 210,
      size: 20,
      font: fontBold,
      color: textColor,
    });

    // Detalhes do Evento
    const detailsY = height - 260;
    
    // Data
    page.drawText('DATA:', { x: 30, y: detailsY, size: 10, font: fontBold, color: primaryColor });
    page.drawText('30 de Maio, 2026', { x: 30, y: detailsY - 20, size: 12, font: fontRegular, color: textColor });

    // Hora
    page.drawText('HORÁRIO:', { x: 220, y: detailsY, size: 10, font: fontBold, color: primaryColor });
    page.drawText('18:00h', { x: 220, y: detailsY - 20, size: 12, font: fontRegular, color: textColor });

    // Local
    page.drawText('LOCAL:', { x: 30, y: detailsY - 60, size: 10, font: fontBold, color: primaryColor });
    page.drawText('Templo Sede - Rua Estevam Aragoni, 77', { x: 30, y: detailsY - 80, size: 12, font: fontRegular, color: textColor });

    // Footer com QR Code
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: 150,
      color: rgb(0.98, 0.95, 0.96),
    });

    // Gerar QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(ticket.code, { margin: 1, width: 200 });
    const qrCodeImage = await pdfDoc.embedPng(qrCodeDataUrl);
    
    page.drawImage(qrCodeImage, {
      x: 30,
      y: 25,
      width: 100,
      height: 100,
    });

    page.drawText('APRESENTE NA ENTRADA', {
      x: 150,
      y: 90,
      size: 10,
      font: fontBold,
      color: primaryColor,
    });

    page.drawText('CÓDIGO DO TICKET:', {
      x: 150,
      y: 70,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`#${ticket.id.toUpperCase()}`, {
      x: 150,
      y: 50,
      size: 18,
      font: fontBold,
      color: textColor,
    });

    // Gerar bytes do PDF
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ingresso-${ticket.id}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: 'Erro ao gerar PDF: ' + error.message }, { status: 500 });
  }
}
