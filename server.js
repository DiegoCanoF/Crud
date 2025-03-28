const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');

// Middleware
app.use(bodyParser.json());

// Servir archivos estáticos (si usas una carpeta frontend)
app.use(express.static(path.join(__dirname, 'frontend')));

// Conectar a la base de datos
const db = new sqlite3.Database('Escuela.db', (err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err.message);
  } else {
    console.log('Conexión a la base de datos exitosa');
  }
});

// Ruta para registrar un usuario
app.post('/registro', (req, res) => {
  const { nombre, correo, contrasena, perfil } = req.body;

  // Encriptar la contraseña antes de almacenarla
  bcrypt.hash(contrasena, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ message: 'Error al encriptar la contraseña' });
    }

    const query = `INSERT INTO usuarios (nombre, correo, contrasena, perfil, solicitud_aprobada) VALUES (?, ?, ?, ?, 0)`;
    db.run(query, [nombre, correo, hashedPassword, perfil], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error al registrar el usuario', error: err });
      }
      res.status(200).json({ message: 'Usuario registrado exitosamente' });
    });
  });
});

// Ruta para iniciar sesión
app.post('/login', (req, res) => {
  const { correo, contrasena } = req.body;

  const query = `SELECT * FROM usuarios WHERE correo = ?`;
  db.get(query, [correo], (err, row) => {
    if (err) {
      return res.status(500).json({ message: 'Error al buscar el usuario', error: err });
    }

    if (!row) {
      return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
    }

    bcrypt.compare(contrasena, row.contrasena, (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error al comparar contraseñas', error: err });
      }

      if (result) {
        res.status(200).json({
          message: 'Inicio de sesión exitoso',
          usuario: {
            id: row.id,
            nombre: row.nombre,
            perfil: row.perfil,
            solicitud_aprobada: row.solicitud_aprobada
          }
        });
      } else {
        res.status(401).json({ message: 'Correo o contraseña incorrectos' });
      }
    });
  });
});

// Ruta para solicitar una cuenta (Estudiante)

app.post('/solicitar-cuenta', (req, res) => {
    const { id } = req.body; // El ID del usuario que envía la solicitud
  
    const query = `UPDATE usuarios SET solicitud_aprobada = 0 WHERE id = ?`;
  
    db.run(query, [id], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error al enviar la solicitud', error: err });
      }
      res.status(200).json({ message: 'Solicitud enviada exitosamente' });
    });
  });

  // Ruta para obtener todas las solicitudes pendientes (Administrador)
app.get('/solicitudes', (req, res) => {
    const query = `SELECT id, nombre, correo, perfil FROM usuarios WHERE solicitud_aprobada = 0`;
  
    db.all(query, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Error al obtener las solicitudes', error: err });
      }
      res.status(200).json({ solicitudes: rows });
    });
  });
// Ruta para obtener el perfil del estudiante
app.get('/perfil/:id', (req, res) => {
  const { id } = req.params;

  const query = `
      SELECT id, nombre, correo, cuenta_asignada, correo_institucional, solicitud_aprobada
      FROM usuarios
      WHERE id = ?
  `;

  db.get(query, [id], (err, row) => {
      if (err) {
          return res.status(500).json({ message: 'Error al obtener el perfil', error: err });
      }

      if (!row) {
          return res.status(404).json({ message: 'Estudiante no encontrado' });
      }

      res.status(200).json(row);
  });
});
// Ruta para aprobar una solicitud de cuenta (Administrador)
app.put('/aprobar-solicitud/:id', (req, res) => {
    const { id } = req.params;
    const numeroCuenta = Math.floor(100000 + Math.random() * 900000); // Número de cuenta aleatorio de 6 dígitos
    const correoInstitucional = `user${numeroCuenta}@escuela.edu`; // Generar correo basado en el número de cuenta

    const query = `
        UPDATE usuarios 
        SET solicitud_aprobada = 1, cuenta_asignada = ?, correo_institucional = ?
        WHERE id = ? AND solicitud_aprobada = 0
    `;

    db.run(query, [numeroCuenta, correoInstitucional, id], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error al aprobar la solicitud', error: err });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Solicitud no encontrada o ya aprobada' });
        }

        // Devolver los detalles de la cuenta aprobada
        res.status(200).json({
            message: 'Solicitud aprobada exitosamente',
            solicitud: {
                id: id,
                cuenta_asignada: numeroCuenta,
                correo_institucional: correoInstitucional
            }
        });
    });
});


  // Ruta para obtener el perfil de un usuario por su ID
app.get('/perfil/:id', (req, res) => {
    const { id } = req.params;
  
    const query = `SELECT id, nombre, correo, perfil, cuenta_asignada, correo_institucional, solicitud_aprobada FROM usuarios WHERE id = ?`;
  
    db.get(query, [id], (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Error al obtener el perfil', error: err });
      }
  
      if (!row) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
  
      res.status(200).json({
        message: 'Perfil obtenido exitosamente',
        perfil: row
      });
    });
  });


  // Ruta para asignar número de cuenta y correo institucional
app.put('/asignar-cuenta/:id', (req, res) => {
    const { id } = req.params;
    const numeroCuenta = Math.floor(100000 + Math.random() * 900000); // Número de cuenta aleatorio
    const correoInstitucional = `user${numeroCuenta}@escuela.edu`; // Correo institucional basado en el número de cuenta
  
    const query = `
      UPDATE usuarios 
      SET cuenta_asignada = ?, correo_institucional = ?
      WHERE id = ?
    `;
  
    db.run(query, [numeroCuenta, correoInstitucional, id], function (err) {
      if (err) {
        return res.status(500).json({ message: 'Error al asignar cuenta', error: err });
      }
  
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
  
      res.status(200).json({
        message: 'Cuenta asignada exitosamente',
        cuenta_asignada: numeroCuenta,
        correo_institucional: correoInstitucional
      });
    });
  });
  
// Ruta para obtener todos los estudiantes
app.get('/estudiantes', (req, res) => {
    const query = 'SELECT id, nombre, correo, solicitud_aprobada, cuenta_asignada, correo_institucional FROM usuarios';
    
    db.all(query, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Error al obtener los estudiantes', error: err });
      }
      
      res.status(200).json(rows); // Devuelve los estudiantes
    });
  });
  
  
  // Eliminar un estudiante (solo para administradores)
  app.delete('/estudiantes/:id', (req, res) => {
    const { id } = req.params;
  
    const query = `DELETE FROM usuarios WHERE id = ? AND perfil = 'estudiante'`;
  
    db.run(query, [id], function (err) {
      if (err) {
        return res.status(500).json({ message: 'Error al eliminar el estudiante', error: err });
      }
  
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Estudiante no encontrado o ya eliminado' });
      }
  
      res.status(200).json({ message: 'Estudiante eliminado exitosamente' });
    });
  });


  // Editar un estudiante (solo para administradores)
app.put('/estudiantes/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, correo, cuenta_asignada, correo_institucional, solicitud_aprobada } = req.body;
  
    const query = `
      UPDATE usuarios 
      SET nombre = ?, correo = ?, cuenta_asignada = ?, correo_institucional = ?, solicitud_aprobada = ? 
      WHERE id = ? AND perfil = 'estudiante'
    `;
  
    db.run(query, [nombre, correo, cuenta_asignada, correo_institucional, solicitud_aprobada, id], function (err) {
      if (err) {
        return res.status(500).json({ message: 'Error al editar el estudiante', error: err });
      }
  
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Estudiante no encontrado o sin cambios' });
      }
  
      res.status(200).json({ message: 'Estudiante editado exitosamente' });
    });
  });
// Iniciar el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
