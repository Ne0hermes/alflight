// === pdfExtractor.js OPTIMISÉ ===
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const P = {
  rwy: /\b(0[1-9]|[12]\d|3[0-6])[LCR]?\b/g,
  freq: /\b1[0-3]\d\.\d{1,3}\b/g,
  ils: /\b(108|109|110|111)\.\d{1,2}\b/g,
  tel: /(?:Tel|Tél|Phone|ATIS)\s*:?\s*([\d\s\-.()]+)/gi,
  qfu: /QFU\s*:?\s*(\d{3})/gi,
  alt: /(\d{3,5})\s*(?:ft|FT|pieds)/g,
  dist: /(\d+)\s*(?:m|M|mètres|meters|NM|nm)/g,
  dms: /([NS])\s*(\d{1,2})°?\s*(\d{1,2})'?\s*(\d{1,2})"?\s*([EW])\s*(\d{1,3})°?\s*(\d{1,2})'?\s*(\d{1,2})"?/g,
  dec: /(\d{1,2}\.\d+)°?\s*([NS])\s*(\d{1,3}\.\d+)°?\s*([EW])/g
};

const K = {
  freq: ['TWR', 'GND', 'ATIS', 'APP', 'AFIS', 'INFO', 'FREQ'],
  rwy: ['RWY', 'PISTE', 'THR', 'RUNWAY'],
  ils: ['ILS', 'LOC', 'DME', 'VOR'],
  min: ['MINIMA', 'MDA', 'DA', 'OCH'],
  pat: ['CIRCUIT', 'PATTERN', 'TFC']
};

export class VACPDFExtractor {
  static #i = null;
  static getInstance() { return this.#i || (this.#i = new VACPDFExtractor()); }

  async extractFromBlob(blob) {
    try {
      const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      let txt = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i);
        const tc = await p.getTextContent();
        txt += tc.items.map(x => x.str).join(' ') + '\n';
      }
      
      return {
        coordinates: this.#coord(txt),
        airportElevation: this.#elev(txt),
        runways: this.#rwy(txt),
        frequencies: this.#freq(txt),
        ils: this.#ils(txt),
        minima: this.#min(txt),
        patternAltitude: this.#pat(txt),
        remarks: this.#rem(txt)
      };
    } catch (e) { throw e; }
  }

  #dms2d(d, m, s, dir) {
    const v = d + m/60 + s/3600;
    return Math.round((dir === 'S' || dir === 'W' ? -v : v) * 1e6) / 1e6;
  }

  #coord(t) {
    const d = [...t.matchAll(P.dms)];
    if (d.length) {
      const [, lD, lDe, lM, lS, loD, loDe, loM, loS] = d[0];
      return {
        lat: this.#dms2d(+lDe, +lM, +lS, lD),
        lon: this.#dms2d(+loDe, +loM, +loS, loD),
        format: 'DMS'
      };
    }
    
    const dc = [...t.matchAll(P.dec)];
    if (dc.length) {
      const [, lV, lD, loV, loD] = dc[0];
      return {
        lat: +lV * (lD === 'S' ? -1 : 1),
        lon: +loV * (loD === 'W' ? -1 : 1),
        format: 'decimal'
      };
    }
    
    const a = t.match(/ARP[:\s]+([NS])\s*(\d{2})°?\s*(\d{2})'?\s*(\d{2})"?\s*([EW])\s*(\d{3})°?\s*(\d{2})'?\s*(\d{2})"?/i);
    if (a) {
      const [, lD, lDe, lM, lS, loD, loDe, loM, loS] = a;
      return {
        lat: this.#dms2d(+lDe, +lM, +lS, lD),
        lon: this.#dms2d(+loDe, +loM, +loS, loD),
        format: 'ARP'
      };
    }
    return null;
  }

  #elev(t) {
    const p = [
      /(?:ELEV|ALT|ALTITUDE)[:\s]+(\d{1,5})\s*(?:ft|FT|pieds)/i,
      /(\d{1,5})\s*(?:ft|FT|pieds)[^°]/i,
      /AD\s+ELEV[:\s]+(\d{1,5})/i
    ];
    
    for (const pt of p) {
      const m = t.match(pt);
      if (m) {
        const e = +m[1];
        if (e >= 0 && e <= 15000) return e;
      }
    }
    return null;
  }

  #rwy(t) {
    const r = [];
    const m = t.match(P.rwy) || [];
    
    m.forEach(rw => {
      const ctx = t.match(new RegExp(`${rw}[^\\n]*(?:\\n[^\\n]*){0,5}`, 'gi'))?.[0] || '';
      const q = ctx.match(/(\d{3})°?/);
      const qfu = q ? +q[1] : +rw.substring(0, 2) * 10;
      const d = ctx.match(/(\d{3,4})\s*[xX×]\s*(\d{2,3})/);
      
      r.push({
        identifier: rw,
        qfu,
        length: d ? +d[1] : 0,
        width: d ? +d[2] : 0,
        surface: this.#surf(ctx)
      });
    });
    
    return this.#uniq(r, 'identifier', (a, b) => a.length > b.length);
  }

  #freq(t) {
    const f = [];
    K.freq.forEach(k => {
      const p = new RegExp(`${k}[^\\n]*${P.freq.source}`, 'gi');
      [...t.matchAll(p)].forEach(m => {
        const fr = m[0].match(P.freq)?.[0];
        if (!fr) return;
        
        const pm = m[0].match(P.tel);
        const hm = m[0].match(/H24|HO|HR\s*[^,\n]+/i);
        
        f.push({
          type: this.#ftype(m[0]),
          frequency: fr,
          hours: hm ? hm[0] : undefined,
          phone: pm ? pm[1].replace(/[\s\-.()]/g, '').replace(/^0/, '+33') : undefined
        });
      });
    });
    
    return this.#uniq(f, x => `${x.type}-${x.frequency}`);
  }

  #ils(t) {
    const i = [];
    const p = /ILS[^\n]*?(\d{2}[LCR]?)[^\n]*?(1(?:08|09|10|11)\.\d{1,2})[^\n]*?([A-Z]{2,3})/gi;
    [...t.matchAll(p)].forEach(m => {
      const [, r, f, id] = m;
      const cm = m[0].match(/CAT\s*([I]{1,3})/i);
      i.push({ runway: r, frequency: f, identifier: id, category: cm ? cm[1] : 'I' });
    });
    return i;
  }

  #min(t) {
    const c = t.match(/(?:CIRCLING|MDH)[^\n]*?(\d{3,4})/i);
    const s = t.match(/(?:STRAIGHT|MDA|DA)[^\n]*?(\d{3,4})/i);
    return !c && !s ? undefined : { circling: c ? +c[1] : 0, straight: s ? +s[1] : 0 };
  }

  #pat(t) {
    const m = t.match(/(?:CIRCUIT|PATTERN|TFC)[^\n]*?(\d{3,4})\s*(?:ft|FT)/i);
    return m ? +m[1] : undefined;
  }

  #rem(t) {
    const m = t.match(/(?:REMARKS?|NOTES?|ATTENTION)[^\n]*\n([^\n]+(?:\n[^\n]+)*)/i);
    return m ? m[1].split(/\n/).filter(l => l.trim().length > 10).slice(0, 5) : [];
  }

  #surf(c) {
    if (/ASPH|ASPHALTE|BITUME/i.test(c)) return 'ASPH';
    if (/GRASS|HERBE|GAZON/i.test(c)) return 'GRASS';
    if (/CONCRETE|BÉTON|BETON/i.test(c)) return 'CONC';
    if (/GRAVEL|GRAVIER/i.test(c)) return 'GRVL';
    return 'UNKN';
  }

  #ftype(c) {
    if (/TWR|TOWER|TOUR/i.test(c)) return 'TWR';
    if (/GND|GROUND|SOL/i.test(c)) return 'GND';
    if (/ATIS/i.test(c)) return 'ATIS';
    if (/APP|APPROACH|APPROCHE/i.test(c)) return 'APP';
    return 'INFO';
  }

  #uniq(a, k, cmp) {
    const u = new Map();
    a.forEach(x => {
      const key = typeof k === 'function' ? k(x) : x[k];
      const ex = u.get(key);
      if (!ex || (cmp && cmp(x, ex))) u.set(key, x);
    });
    return Array.from(u.values());
  }
}

export const pdfExtractor = VACPDFExtractor.getInstance();