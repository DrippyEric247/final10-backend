// Start simple; you can upgrade to NLP/CV later
const BRANDS = [
  'nike','jordan','apple','samsung','sony','ps5','xbox','lenovo','dell','yeezy',
  'gucci','prada','coach','louis vuitton','ipad','iphone','macbook','rolex','nvidia','gpu','sneakers'
];

function isProductText(text = '') {
  const t = text.toLowerCase();
  return BRANDS.some(b => t.includes(b));
}

module.exports = { isProductText, BRANDS };

