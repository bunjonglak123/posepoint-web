// รันโมเดลลำดับเวลา (LSTM / 1D-CNN ที่เทรนด้วย PyTorch แล้วส่งออกด้วย export_ensemble.py) ในเบราว์เซอร์
// ต้องคำนวณตรงกับ PyTorch ทุกขั้น — มีเทสต์ parity (tests/ensemble.test.js)

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function median(v) {
  const s = [...v].sort((a, b) => a - b), pos = (s.length - 1) / 2;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// เฟรมของหนึ่งครั้ง -> ลำดับยาวคงที่ len × 5 ช่อง (ตรงกับ rep_sequence ใน seq_models.py)
// ครั้งที่ใช้เวลาต่างกันจึงเทียบกันได้; ความลึกหารความยาวต้นแขนให้ไม่ขึ้นกับขนาดตัว/ระยะกล้อง
export function repSequence(frames, len) {
  if (!frames || !frames.length) throw new Error("rep ต้องมีอย่างน้อย 1 เฟรม");
  const arm = median(frames.map(f => f.armLen)) || 1e-6;
  const raw = frames.map(f => [f.elbowAngle / 180, f.backAngle / 180, f.kneeAngle / 180, f.wsd / arm, f.lowerVis]);
  const n = raw.length;
  return Array.from({ length: len }, (_, i) => {
    if (n === 1) return [...raw[0]];
    const pos = (len === 1 ? 0 : i / (len - 1)) * (n - 1);      // np.interp บนแกนเวลาที่แบ่งเท่า ๆ กัน
    const lo = Math.min(Math.floor(pos), n - 1), hi = Math.min(lo + 1, n - 1), t = pos - lo;
    return raw[lo].map((v, c) => v + (raw[hi][c] - v) * t);
  });
}

const standardize = (seq, mu, sd) => seq.map(x => x.map((v, c) => (v - mu[c]) / sd[c]));

// LSTM ชั้นเดียว ลำดับเกตแบบ PyTorch: input, forget, cell(g), output; ใช้สถานะสุดท้ายตัดสิน
export function lstmLogit(m, seq) {
  const H = m.hidden;
  let h = new Array(H).fill(0);
  const c = new Array(H).fill(0);
  for (const x of seq) {
    const g = m.b.map((b, r) => {
      let s = b;
      const wi = m.wih[r], wh = m.whh[r];
      for (let k = 0; k < x.length; k++) s += wi[k] * x[k];
      for (let k = 0; k < H; k++) s += wh[k] * h[k];
      return s;
    });
    const next = new Array(H);
    for (let j = 0; j < H; j++) {
      c[j] = sigmoid(g[H + j]) * c[j] + sigmoid(g[j]) * Math.tanh(g[2 * H + j]);
      next[j] = sigmoid(g[3 * H + j]) * Math.tanh(c[j]);
    }
    h = next;
  }
  return h.reduce((s, v, j) => s + m.fc_w[j] * v, m.fc_b);
}

// Conv1d (padding ด้วยศูนย์) ตามด้วย ReLU; x: [ช่อง][เวลา], w: [ออก][เข้า][kernel]
function convRelu(x, w, b, pad) {
  const T = x[0].length, K = w[0][0].length;
  return w.map((wo, o) => {
    const y = new Array(T);
    for (let t = 0; t < T; t++) {
      let s = b[o];
      for (let ci = 0; ci < x.length; ci++) {
        const wc = wo[ci], xc = x[ci];
        for (let k = 0; k < K; k++) {
          const ti = t + k - pad;
          if (ti >= 0 && ti < T) s += wc[k] * xc[ti];
        }
      }
      y[t] = s > 0 ? s : 0;
    }
    return y;
  });
}

// 1D-CNN: conv-relu-conv-relu -> max ตามเวลา -> linear
export function cnnLogit(m, seq) {
  const x = seq[0].map((_, c) => seq.map(row => row[c]));        // [เวลา][ช่อง] -> [ช่อง][เวลา]
  const h = convRelu(convRelu(x, m.c1_w, m.c1_b, m.pad), m.c2_w, m.c2_b, m.pad);
  return h.reduce((s, ch, o) => s + m.fc_w[o] * Math.max(...ch), m.fc_b);
}

// ความน่าจะเป็นที่ท่าผิดจากโมเดลลำดับเวลาที่ไฟล์โมเดลมี (คืน {} ถ้าไม่มี)
export function seqProbas(model, frames) {
  if (!model.seq) return {};
  const seq = standardize(repSequence(frames, model.seq.len), model.seq.mu, model.seq.sd);
  const out = {};
  if (model.lstm) out.lstm = sigmoid(lstmLogit(model.lstm, seq));
  if (model.cnn) out.cnn = sigmoid(cnnLogit(model.cnn, seq));
  return out;
}
