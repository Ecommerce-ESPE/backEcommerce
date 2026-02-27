const jwt = require('jsonwebtoken');

const generarJWT = ( uid, sessionVersion = 0 ) => {

    return new Promise( ( resolve, reject ) => {

        const payload = {
            uid,
            sv: Number(sessionVersion || 0),
        };
    
        jwt.sign( payload, process.env.JWT_SECRET, {
            expiresIn: '12h'
        }, ( err, token ) => {
    
            if ( err ) {
                console.log(err);
                reject('No se pudo generar el JWT');
            } else {
                resolve( token );
            }
    
        });

    });

}


module.exports = {
    generarJWT,
}
