const express = require('express');
const cors = require('cors');

// ----- Configuración -----
// N = número de lista del primer integrante del equipo (orden alfabético por apellido)
const N = 13;
const PUERTO = 3050;
const ORIGEN_PERMITIDO = 'http://localhost:5500';

const CREDENCIAL = `CIAF-${N}`;
const ESTADOS = ['Registrado', 'En tránsito', 'Entregado'];

const app = express();

// ----- CORS -----
// Va antes de la validación porque el preflight (OPTIONS) del navegador
// no incluye el valor de los encabezados personalizados.
app.use(cors({
  origin: ORIGEN_PERMITIDO,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Red-Equipo'],
  exposedHeaders: ['X-Servidor-Procesado'],
}));

// ----- Middleware: valida el encabezado X-Red-Equipo -----
function validarEquipo(req, res, next) {
  const valor = req.get('X-Red-Equipo');

  if (valor !== CREDENCIAL) {
    return res.status(401).json({
      error: 'Unauthorized',
      mensaje: valor === undefined
        ? 'Falta el encabezado obligatorio X-Red-Equipo.'
        : 'El valor del encabezado X-Red-Equipo no es válido.',
    });
  }

  next();
}

app.use(validarEquipo);
app.use(express.json());

// Responde con éxito agregando el encabezado personalizado del equipo
function responderExito(res, codigo, cuerpo) {
  res.set('X-Servidor-Procesado', `Equipo-${N}`);
  res.status(codigo).json(cuerpo);
}

// ----- Datos en memoria (se reinician al apagar el servidor) -----
const envios = [
  { id: 1, guia: 'ENV-001', destinatario: 'Ana Ruiz', ciudad: 'Pereira', estado: 'En tránsito' },
  { id: 2, guia: 'ENV-002', destinatario: 'Luis Mora', ciudad: 'Manizales', estado: 'Entregado' },
];

// ----- Endpoints -----
// GET /api/recurso            -> todos los envíos
// GET /api/recurso?guia=...   -> un envío por número de guía
app.get('/api/recurso', (req, res) => {
  const { guia } = req.query;
  if (guia === undefined) {
    return responderExito(res, 200, { total: envios.length, envios });
  }

  const envio = envios.find((e) => e.guia === guia);
  if (!envio) {
    return res.status(404).json({ error: 'Not Found', mensaje: 'No existe un envío con esa guía.' });
  }
  responderExito(res, 200, envio);
});

// POST /api/recurso -> registra un envío
app.post('/api/recurso', (req, res) => {
  const { destinatario, ciudad, estado = 'Registrado' } = req.body ?? {};
  const esTexto = (v) => typeof v === 'string' && v.trim() !== '';

  if (!esTexto(destinatario) || !esTexto(ciudad)) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: 'Los campos destinatario y ciudad son obligatorios.',
    });
  }
  if (!ESTADOS.includes(estado)) {
    return res.status(400).json({
      error: 'Bad Request',
      mensaje: `El estado debe ser uno de: ${ESTADOS.join(', ')}.`,
    });
  }

  const id = envios.length + 1;
  const envio = { id, guia: `ENV-${String(id).padStart(3, '0')}`, destinatario, ciudad, estado };
  envios.push(envio);
  responderExito(res, 201, { mensaje: 'Envío registrado.', envio });
});

// ----- Rutas inexistentes y errores -----
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', mensaje: 'La ruta solicitada no existe.' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Bad Request', mensaje: 'El cuerpo no es un JSON válido.' });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: 'Error', mensaje: 'No se pudo procesar la solicitud.' });
});

app.listen(PUERTO, (error) => {
  if (error) {
    console.error(`No se pudo iniciar el servidor: ${error.message}`);
    process.exit(1);
  }
  console.log(`Servidor en http://localhost:${PUERTO}`);
  console.log(`Encabezado requerido -> X-Red-Equipo: ${CREDENCIAL}`);
});
