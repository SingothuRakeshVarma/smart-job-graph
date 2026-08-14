function nodeProps(record, key = 'n') {
  const value = record.get(key);
  return value && value.properties ? value.properties : value;
}

function toPlain(value) {
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    if (value.properties) return toPlain(value.properties);
    const output = {};
    for (const [key, item] of Object.entries(value)) output[key] = toPlain(item);
    return output;
  }
  return value;
}

module.exports = { nodeProps, toPlain };
