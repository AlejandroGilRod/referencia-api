import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import { getReferencia } from './obtener_referencia.js'; // ← Ajusta el nombre si tu script tiene otro nombre

const app = express();
const port = process.env.PORT || 3000;


app.use(bodyParser.json());

app.post('/getReferencia', async (req, res) => {
  try {
    const { dni, fecha, casilla } = req.body;

    if (!dni || !fecha || !casilla) {
      return res.status(400).json({ error: 'Faltan parámetros: dni, fecha o casilla.' });
    }

    const referencia = await getReferencia(dni, fecha, casilla);

    if (referencia) {
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=referencia_${referencia}.pdf`,
          'X-Referencia': referencia, // 👈 referencia como header
        });
      
        res.send(fs.readFileSync('pagina_final.pdf'));
      }
      else {
      return res.status(500).json({ error: 'No se pudo obtener la referencia.' });
    }
  } catch (err) {
    console.error('❌ Error interno:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});
app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });
  
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
