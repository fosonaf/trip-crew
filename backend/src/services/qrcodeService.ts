import QRCode from 'qrcode';

export const generateQRCode = async (data: object): Promise<string> => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(data));
    return qrCodeDataURL;
  } catch (error) {
    console.error('QR code generation error:', error);
    throw error;
  }
};

export const generateQRCodeBuffer = async (data: object): Promise<Buffer> => {
  try {
    const qrCodeBuffer = await QRCode.toBuffer(JSON.stringify(data));
    return qrCodeBuffer;
  } catch (error) {
    console.error('QR code buffer generation error:', error);
    throw error;
  }
};