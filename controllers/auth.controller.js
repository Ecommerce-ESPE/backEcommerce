const { response } = require('express');
const bcrypt = require('bcryptjs');
const { userModel } = require('../models/index');
const { generarJWT } = require('../helpers/jwt');
const { config } = require('dotenv');
//const { registrarAuditoria } = require('../helpers/auditoria');

const login = async(req, res = response) => {
    const { email, password } = req.body;

    try {
        // Verificar email
        const usuarioDB = await userModel.findOne({ email });
        
        if (!usuarioDB) {
            
            return res.status(404).json({
                ok: false,
                msg: 'Email no encontrado'
            });
        }

        // Verificar contraseña
        const validPassword = bcrypt.compareSync(password, usuarioDB.password);
        
        if (!validPassword) {
            //await registrarAuditoria({
            //    usuarioId: usuarioDB._id,
            //    accion: 'INTENTO_LOGIN_PASSWORD_INCORRECTO',
            //    descripcion: `Intento de login con password incorrecto para ${email}`,
            //    entidad: 'Auth',
            //    req
            //});           
            return res.status(400).json({
                ok: false,
                msg: 'Contraseña incorrecta'
            });
        }

        // Generar el TOKEN - JWT
        const token = await generarJWT(usuarioDB.id);

        // Registrar login exitoso
        //await registrarAuditoria({
        //    usuarioId: usuarioDB._id,
        //    accion: 'LOGIN_EXITOSO',
        //    descripcion: `Inició sesión correctamente`,
        //    entidad: 'Auth',
        //    req
        //});

        res.json({
            ok: true,
            token,
            usuario: {
                uid: usuarioDB._id,
                nombre: usuarioDB.name,
                email: usuarioDB.email,
                rol: usuarioDB.role,
                perfil: usuarioDB.profileUrl || null,
                config: usuarioDB.config || {},
                wallet: usuarioDB.credits || 0
            }
        });

    } catch (error) {
        console.error(error);
        
        //await registrarAuditoria({
        //    accion: 'ERROR_LOGIN',
        //    descripcion: `Error en el proceso de login: ${error.message}`,
        //    entidad: 'Auth',
        //    req
        //});
        
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado al iniciar sesión'
        });
    }
};


const renewToken = async(req, res = response) => {
    const uid = req.uid;

    try {
        // Generar nuevo token
        const token = await generarJWT(uid);

        // Obtener el usuario
        const usuario = await userModel.findById(uid);

        if (!usuario) {
            
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        res.json({
            ok: true,
            token,
            usuario: {
                uid: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error(error);
        
        await registrarAuditoria({
            usuarioId: uid,
            accion: 'ERROR_RENOVACION_TOKEN',
            descripcion: `Error al renovar token: ${error.message}`,
            entidad: 'Auth',
            req
        });
        
        res.status(500).json({
            ok: false,
            msg: 'Error al renovar el token'
        });
    }
};

const register = async(req, res = response) =>{
    const { name, email, password, phone, address, profileUrl, ci} = req.body;
        
        try {
            // 2. Validar existencia de email
            const existeEmail = await userModel.findOne({ email });
            if (existeEmail) {
                return res.status(400).json({
                    ok: false,
                    msg: 'El correo ya está registrado'
                });
            }
    
            // 3. Crear usuario con valores controlados
            const usuario = new userModel({
                name,
                email,
                password,
                ci: ci || "", 
                phone: phone || "",
                //address: address || {},
                profileUrl: profileUrl || "",
                role: "USER", // Rol fijo explícito
                credits: 0     // Créditos fijos explícitos
            });
        
            // 4. Encriptar contraseña
            const salt = bcrypt.genSaltSync();
            usuario.password = bcrypt.hashSync(password, salt);
        
            // 5. Guardar usuario
            await usuario.save();
    
            // 6. Generar token JWT
            const token = await generarJWT(usuario.id);
    
            res.json({
                ok: true,
                usuario,
                token
            });
    
        } catch (error) {
            console.log(error);
            res.status(500).json({
                ok: false,
                msg: 'Error inesperado... revisar logs'
            });
        }
}


module.exports = {
    login,
    renewToken, 
    register
};