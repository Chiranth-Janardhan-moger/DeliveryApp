const generateId = (prefix = '') => {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const generateOrderId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `ORD-${timestamp}${random}`;
};

const sanitizeUser = (user) => {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePhone = (phone) => {
  const re = /^[0-9]{10}$/;
  return re.test(phone);
};

const isEmailOrPhone = (input) => {
  if (validateEmail(input)) return 'email';
  if (validatePhone(input)) return 'phone';
  return null;
};

module.exports = {
  generateId,
  generateOrderId,
  sanitizeUser,
  validateEmail,
  validatePhone,
  isEmailOrPhone
};
