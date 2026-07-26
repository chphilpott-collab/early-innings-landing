module.exports = async (req, res) => {
  res.status(200).json({
    SMTP_USER: !!process.env.SMTP_USER,
    SMTP_PASSWORD: !!process.env.SMTP_PASSWORD,
    SMTP_USER_VALUE: process.env.SMTP_USER || 'UNDEFINED',
    SMTP_PASSWORD_VALUE: process.env.SMTP_PASSWORD || 'UNDEFINED',
    NODE_ENV: process.env.NODE_ENV,
  });
};
