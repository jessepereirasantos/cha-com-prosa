import nodemailer from 'nodemailer';

export async function sendTicketEmail(to: string, ticketData: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to,
    subject: `Sua vaga está garantida! - Chá com Prosa`,
    html: `
      <div style="font-family: serif; color: #6b002a; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #fce7eb; border-radius: 20px;">
        <h1 style="text-align: center; font-style: italic;">Chá com Prosa</h1>
        <p>Olá, ${ticketData.name}!</p>
        <p>Sua participação na edição <b>Mulheres com Propósito</b> foi confirmada com sucesso. Estamos te esperando!</p>
        <div style="background: #fdf2f4; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p><b>Seu Código de Ingresso:</b> ${ticketData.code}</p>
          <p><b>Data:</b> 30 de Maio de 2026 às 18h</p>
          <p><b>Local:</b> Templo Sede da IADE — Rua Estevam Aragoni, 77 - Cipó, Embu-Guaçu - SP</p>
          <p><a href="https://www.google.com/maps/dir/?api=1&destination=Rua+Estevam+Aragoni,+77+-+Cipó+-+Embu-Guaçu" style="color: #6b002a;">📍 Ver no Google Maps</a></p>
        </div>
        <p style="color: #555;">Chegue com 15 minutos de antecedência para retirada do seu Kit de Boas-Vindas.</p>
        <p style="font-size: 12px; color: #999;">Apresente este e-mail ou o código acima na entrada do evento.</p>
        <hr style="border: none; border-top: 1px solid #fce7eb; margin: 20px 0;" />
        <p style="font-size: 11px; color: #ccc; text-align: center;">© 2026 Chá com Prosa · Um encontro de irmandade e sofisticação.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return info;
  } catch (error) {
    console.error('Email error:', error);
    throw error;
  }
}
