const {userModel} = require('../../models/index');
const bcrypt = require('bcryptjs');
const {generarJWT} = require('../../helpers/jwt');

const getUserAll = async (req,res)=>{
    const {body} = req;
    const data = await userModel.find({});
    
    res.json({
        msg:"Succesfull",
        user: data
    })
}

const crearUsuario = async(req, res = response) => {
    // 1. Filtrar campos permitidos (whitelisting)
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
        const token = await generarJWT(usuario.id, usuario.sessionVersion || 0);

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

const actualizarUsuario = async (req, res = response) => {

    // TODO: Validar token y comprobar si es el usuario correcto
    //const uid = req.params.id;
    const uid = req.uid;
    try {

        const usuarioDB = await userModel.findById( uid );

        if ( !usuarioDB ) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe un usuario por ese id'
            });
        }

        // Actualizaciones
        const { password, google, email, ...campos } = req.body;

        if ( usuarioDB.email !== email ) {

            const existeEmail = await userModel.findOne({ email });
            if ( existeEmail ) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Ya existe un usuario con ese email'
                });
            }
        }
        
        const usuarioActualizado = await userModel.findByIdAndUpdate( uid, campos, { new: true } );

        res.json({
            ok: true,
            usuario: usuarioActualizado
        });

        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        })
    }

}


const borrarUsuario = async(req, res = response ) => {

    const uid = req.params.id;

    try {

        const usuarioDB = await userModel.findById( uid );

        if ( !usuarioDB ) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe un usuario por ese id'
            });
        }

        await userModel.findByIdAndDelete( uid );

        
        res.json({
            ok: true,
            msg: 'Usuario eliminado'
        });

    } catch (error) {
        
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Hable con el administrador'
        });

    }


}
// 
const getUserById = async (req, res) => {
    const user = req.uid;
    try {
        const usuarioDB = await userModel.findById(user);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe un usuario por ese id'
            });
        }
        if (Array.isArray(usuarioDB.address) && usuarioDB.address.length > 0) {
            let changed = false;
            const hasPrimary = usuarioDB.address.some((addr) => addr?.isPrimary === true);
            usuarioDB.address = usuarioDB.address.map((addr, idx) => {
                const base = addr?.toObject ? addr.toObject() : addr;
                const next = { ...base };
                if (!hasPrimary && idx === 0) {
                    next.isPrimary = true;
                    changed = true;
                }
                if (!next.label || typeof next.label !== "string" || !next.label.trim()) {
                    next.label = `Direccion ${idx + 1}`;
                    changed = true;
                }
                return next;
            });
            if (changed) {
                await usuarioDB.save();
            }
        }
        res.json({
            ok: true,
            usuario: usuarioDB,
            addressSummary: {
                total: Array.isArray(usuarioDB.address) ? usuarioDB.address.length : 0,
                primary: Array.isArray(usuarioDB.address)
                    ? usuarioDB.address.find((addr) => addr?.isPrimary === true) || usuarioDB.address[0] || null
                    : null,
                coverage: Array.isArray(usuarioDB.address)
                    ? (usuarioDB.address.find((addr) => addr?.isPrimary === true)?.canton ||
                      usuarioDB.address.find((addr) => addr?.isPrimary === true)?.provincia ||
                      usuarioDB.address[0]?.canton ||
                      usuarioDB.address[0]?.provincia ||
                      null)
                    : null
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
}

const getUserByIdAdmin = async (req, res) => {
    const userId = req.params.id;
    try {
        const usuarioDB = await userModel.findById(userId);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe un usuario por ese id'
            });
        }
        if (Array.isArray(usuarioDB.address) && usuarioDB.address.length > 0) {
            let changed = false;
            const hasPrimary = usuarioDB.address.some((addr) => addr?.isPrimary === true);
            usuarioDB.address = usuarioDB.address.map((addr, idx) => {
                const base = addr?.toObject ? addr.toObject() : addr;
                const next = { ...base };
                if (!hasPrimary && idx === 0) {
                    next.isPrimary = true;
                    changed = true;
                }
                if (!next.label || typeof next.label !== "string" || !next.label.trim()) {
                    next.label = `Direccion ${idx + 1}`;
                    changed = true;
                }
                return next;
            });
            if (changed) {
                await usuarioDB.save();
            }
        }
        res.json({
            ok: true,
            usuario: usuarioDB,
            addressSummary: {
                total: Array.isArray(usuarioDB.address) ? usuarioDB.address.length : 0,
                primary: Array.isArray(usuarioDB.address)
                    ? usuarioDB.address.find((addr) => addr?.isPrimary === true) || usuarioDB.address[0] || null
                    : null,
                coverage: Array.isArray(usuarioDB.address)
                    ? (usuarioDB.address.find((addr) => addr?.isPrimary === true)?.canton ||
                      usuarioDB.address.find((addr) => addr?.isPrimary === true)?.provincia ||
                      usuarioDB.address[0]?.canton ||
                      usuarioDB.address[0]?.provincia ||
                      null)
                    : null
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
}
const addAdress = async (req, res) => {
    const userId = req.uid;
    const address = req.body;

    try {
        const usuarioDB = await userModel.findById(userId);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe un usuario por ese id'
            });
        }

        // Si address no es un array, inicialízalo como uno vacío
        if (!Array.isArray(usuarioDB.address)) {
            usuarioDB.address = [];
        }

        if (!usuarioDB.address.length) {
            address.isPrimary = true;
        }
        if (!address.label || typeof address.label !== "string" || !address.label.trim()) {
            address.label = `Direccion ${usuarioDB.address.length + 1}`;
        }

        usuarioDB.address.push(address);
        await usuarioDB.save();

        res.json({
            ok: true,
            usuario: usuarioDB
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
}

const setPrimaryAddress = async (req, res) => {
    const userId = req.uid;
    const index = Number.parseInt(req.body?.index, 10);

    if (!Number.isFinite(index) || index < 0) {
        return res.status(400).json({
            ok: false,
            msg: 'Indice de direccion invalido'
        });
    }

    try {
        const usuarioDB = await userModel.findById(userId);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe un usuario por ese id'
            });
        }

        if (!Array.isArray(usuarioDB.address) || usuarioDB.address.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'El usuario no tiene direcciones registradas'
            });
        }

        if (index >= usuarioDB.address.length) {
            return res.status(400).json({
                ok: false,
                msg: 'Indice de direccion fuera de rango'
            });
        }

        usuarioDB.address = usuarioDB.address.map((addr, idx) => ({
            ...(addr?.toObject ? addr.toObject() : addr),
            isPrimary: idx === index
        }));

        await usuarioDB.save();

        return res.json({
            ok: true,
            usuario: usuarioDB
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
}

const deleteAddress = async (req, res) => {
    const userId = req.uid;
    const index = Number.parseInt(req.params?.index, 10);

    if (!Number.isFinite(index) || index < 0) {
        return res.status(400).json({
            ok: false,
            msg: 'Indice de direccion invalido'
        });
    }

    try {
        const usuarioDB = await userModel.findById(userId);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe un usuario por ese id'
            });
        }

        if (!Array.isArray(usuarioDB.address) || usuarioDB.address.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'El usuario no tiene direcciones registradas'
            });
        }

        if (index >= usuarioDB.address.length) {
            return res.status(400).json({
                ok: false,
                msg: 'Indice de direccion fuera de rango'
            });
        }

        const removingPrimary = usuarioDB.address[index]?.isPrimary === true;
        usuarioDB.address.splice(index, 1);

        if (removingPrimary && usuarioDB.address.length > 0) {
            usuarioDB.address = usuarioDB.address.map((addr, idx) => ({
                ...(addr?.toObject ? addr.toObject() : addr),
                isPrimary: idx === 0
            }));
        }

        await usuarioDB.save();

        return res.json({
            ok: true,
            usuario: usuarioDB
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
}

const updateAddress = async (req, res) => {
    const userId = req.uid;
    const index = Number.parseInt(req.params?.index, 10);
    const payload = req.body || {};

    if (!Number.isFinite(index) || index < 0) {
        return res.status(400).json({
            ok: false,
            msg: 'Indice de direccion invalido'
        });
    }

    try {
        const usuarioDB = await userModel.findById(userId);
        if (!usuarioDB) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe un usuario por ese id'
            });
        }

        if (!Array.isArray(usuarioDB.address) || usuarioDB.address.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'El usuario no tiene direcciones registradas'
            });
        }

        if (index >= usuarioDB.address.length) {
            return res.status(400).json({
                ok: false,
                msg: 'Indice de direccion fuera de rango'
            });
        }

        const current = usuarioDB.address[index];
        const base = current?.toObject ? current.toObject() : current;

        const next = {
            ...base,
            ...payload
        };

        if (typeof payload.isPrimary === "boolean") {
            next.isPrimary = payload.isPrimary;
        } else {
            next.isPrimary = base.isPrimary === true;
        }

        if (!next.label || typeof next.label !== "string" || !next.label.trim()) {
            next.label = base.label || `Direccion ${index + 1}`;
        }

        if (!next.codigoPostal && base.codigoPostal) {
            next.codigoPostal = base.codigoPostal;
        }

        if (!next.telefono && base.telefono) {
            next.telefono = base.telefono;
        }

        usuarioDB.address[index] = next;

        if (next.isPrimary === true) {
            usuarioDB.address = usuarioDB.address.map((addr, idx) => ({
                ...(addr?.toObject ? addr.toObject() : addr),
                isPrimary: idx === index
            }));
        }
        await usuarioDB.save();

        return res.json({
            ok: true,
            usuario: usuarioDB
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            ok: false,
            msg: 'Error inesperado'
        });
    }
}
module.exports = {
    getUserAll,
    crearUsuario,
    actualizarUsuario,
    borrarUsuario,
    getUserById,
    getUserByIdAdmin,
    addAdress,
    setPrimaryAddress,
    deleteAddress,
    updateAddress
}
