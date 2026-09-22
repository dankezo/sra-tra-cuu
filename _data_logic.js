/* Conservative product identity: never merge different names or known variants. */
(function (root) {
  const norm = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  function strengthKey(value) {
    const text = norm(value).replace(/(\d),(\d)/g, '$1.$2');
    const match = text.match(/^(\d+(?:\.\d+)?)\s*(mg|g|mcg|µg|ug)$/);
    if (!match) return text;
    return String(Number(match[1]) * (match[2] === 'g' ? 1000 : match[2] === 'mg' ? 1 : .001)) + 'mg';
  }
  const src = r => r[0] === 'EMA' || r[6] === 'e' ? 'e' : 'd';
  const valueKey = (r, i) => i === 4 ? strengthKey(r[i]) : norm(r[i]);
  function mergeRows(rows) {
    const groups = new Map();
    for (const r of rows) {
      // Without a name or ingredient there is not enough evidence to merge products.
      const key = norm(r[1]) && norm(r[2]) ? norm(r[1]) + '\t' + norm(r[2]) : JSON.stringify(r.slice(1, 6));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const output = [];
    for (const group of groups.values()) {
      const score = r => r.slice(1, 6).filter(v => norm(v)).length;
      const ordered = group.slice().sort((a, b) => score(b) - score(a) || Number(src(b) === 'd') - Number(src(a) === 'd'));
      const variants = [];
      for (const r of ordered) {
        const candidate = variants.find(v => [1, 2, 3, 4, 5].every(i => !norm(v[i]) || !norm(r[i]) || valueKey(v, i) === valueKey(r, i)));
        if (candidate) {
          for (let i = 1; i <= 5; i++) if (!candidate[i] && r[i]) candidate[i] = r[i];
          candidate._sources = [...new Set([...candidate._sources, src(r)])];
          candidate._inns[src(r)] = r[1];
        } else {
          const copy = r.slice();
          copy._sources = [src(r)];
          copy._inns = { [src(r)]: r[1] };
          variants.push(copy);
        }
      }
      output.push(...variants);
    }
    return output;
  }
  function strengthMatches(raw, typed) {
    if (!norm(typed)) return true;
    const target = /^\d+(?:[.,]\d+)?$/.test(norm(typed)) ? typed + ' mg' : typed;
    return strengthKey(raw) === strengthKey(target);
  }
  const api = { norm, strengthKey, mergeRows, strengthMatches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SraData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
