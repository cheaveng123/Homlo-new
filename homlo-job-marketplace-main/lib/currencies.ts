// ESTIMATED rates per 1 USD, for display only. Replace with a real rates feed later.
const RAW = `USD|US Dollar|$|1
KHR|Cambodian Riel|៛|4050
THB|Thai Baht|฿|35
VND|Vietnamese Dong|₫|25400
LAK|Lao Kip|₭|21800
MMK|Myanmar Kyat|K|2100
MYR|Malaysian Ringgit|RM|4.5
SGD|Singapore Dollar|S$|1.34
IDR|Indonesian Rupiah|Rp|16200
PHP|Philippine Peso|₱|57
BND|Brunei Dollar|B$|1.34
CNY|Chinese Yuan|¥|7.2
HKD|Hong Kong Dollar|HK$|7.8
MOP|Macanese Pataca|MOP$|8
TWD|New Taiwan Dollar|NT$|32
JPY|Japanese Yen|¥|150
KRW|South Korean Won|₩|1350
EUR|Euro|€|0.92
GBP|British Pound|£|0.78
AUD|Australian Dollar|A$|1.5
NZD|New Zealand Dollar|NZ$|1.65
CAD|Canadian Dollar|C$|1.37
CHF|Swiss Franc|CHF|0.88
INR|Indian Rupee|₹|84
BDT|Bangladeshi Taka|৳|120
LKR|Sri Lankan Rupee|Rs|300
NPR|Nepalese Rupee|Rs|134
PKR|Pakistani Rupee|₨|280
BTN|Bhutanese Ngultrum|Nu|84
MVR|Maldivian Rufiyaa|Rf|15.4
MNT|Mongolian Tögrög|₮|3400
KZT|Kazakhstani Tenge|₸|480
UZS|Uzbekistani Som|UZS|12700
AED|UAE Dirham|AED|3.67
SAR|Saudi Riyal|SAR|3.75
QAR|Qatari Riyal|QAR|3.64
KWD|Kuwaiti Dinar|KWD|0.31
BHD|Bahraini Dinar|BHD|0.38
OMR|Omani Rial|OMR|0.38
ILS|Israeli Shekel|₪|3.7
TRY|Turkish Lira|₺|42
RUB|Russian Ruble|₽|90
UAH|Ukrainian Hryvnia|₴|41
PLN|Polish Złoty|zł|4
CZK|Czech Koruna|Kč|23
HUF|Hungarian Forint|Ft|360
RON|Romanian Leu|lei|4.6
SEK|Swedish Krona|kr|10.5
NOK|Norwegian Krone|kr|10.7
DKK|Danish Krone|kr|6.9
EGP|Egyptian Pound|E£|50
ZAR|South African Rand|R|18
NGN|Nigerian Naira|₦|1550
KES|Kenyan Shilling|KSh|129
GHS|Ghanaian Cedi|GH₵|15
MAD|Moroccan Dirham|MAD|9.8
BRL|Brazilian Real|R$|5.5
MXN|Mexican Peso|MX$|18
ARS|Argentine Peso|AR$|1000
CLP|Chilean Peso|CLP|940
COP|Colombian Peso|COL$|4100
PEN|Peruvian Sol|S/|3.8`;

export type Currency = { code: string; name: string; symbol: string; perUsd: number };

export const CURRENCIES: Currency[] = RAW.split('\n').map((line) => {
  const [code, name, symbol, rate] = line.split('|');
  return { code, name, symbol, perUsd: Number(rate) };
});

export const formatRate = (v: number) =>
  v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2);

// ── Legacy exports kept for existing consumers (tests/currencies.test.ts) ──
export const validCurrencies: readonly Currency[] = CURRENCIES;

export const currencyOptions: readonly string[] = validCurrencies.map((currency) => `${currency.code} · ${currency.name}`);

export function currencyLabel(code: string): string {
  const match = validCurrencies.find((currency) => currency.code.toLowerCase() === (code || "").trim().toLowerCase());
  return match ? `${match.code} · ${match.name}` : (code || "").trim();
}

export function currencyCode(label: string): string {
  const code = (label || "").split(" · ")[0]?.trim() ?? "";
  const match = validCurrencies.find((currency) => currency.code.toLowerCase() === code.toLowerCase());
  return match ? match.code : label;
}