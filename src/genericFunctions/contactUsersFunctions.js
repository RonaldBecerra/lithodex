import qs from 'qs';
import { Linking } from 'react-native'; // Podemos usar react-native Linking para enviar un correo electrónico

/* Forma fácil de enviar correos usando "qs" y "Linking". No se utilizó porque se activa automáticamente


   Nota: Dicen en Internet que este método no permite adjuntar archivos, pero haciendo pruebas se verificó que al menos
   en Android sí se logra. Ello porque esta función nos lleva a una nueva interfaz (ajena a la aplicación) en la
   que hay un botón para adjuntar archivo. Lo que sí es cierto es que no podemos adjuntarlo directamente desde
   aquí, pasándolo como parámetro 
*/
export async function SendEmailQS(to, subject, body, options = {}) {
    const { cc, bcc } = options;

    let url = `mailto:${to}`;

    // Create email link query
    const query = qs.stringify({
        subject: subject,
        body: body,
        cc: cc,
        bcc: bcc
    });

    if (query.length) {
        url += `?${query}`;
    }

    // check if we can use this link
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
        throw new Error('Provided URL can not be handled');
    }

    return Linking.openURL(url);
}
