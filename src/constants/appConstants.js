import PouchDB from 'pouchdb-react-native'
PouchDB.plugin(require('pouchdb-adapter-asyncstorage').default);

/*Las imágenes que son guardadas por la aplicación, como la imagen de perfil de un usuario o las que se añaden a un estrato de un núcleo o afloramiento,
  se almacenarán como una cadena de caracteres de formato "base64". Pero para que esa cadena pueda ser interpretada como imagen al momento de
  colocarla en un componente Image de React Native es necesario concatenarle esta cadena URI_PREFIX al principio como prefijo

  Esta cadena no se guarda junto con el resto del "base64" en los documentos de las imágenes porque necesitamos el base64 sin este prefijo
  al momento de guardar la imagen correspondiente en la memoria del dispositivo que se está utilizando*/
export const URI_PREFIX = 'data:image/jpeg;base64,';

// Puerto al que hay que acceder para conectarse con el servidor
export const SERVER_PORT = "5984";

// Inicio de URL en la que accedemos con un usuario y contraseña iguales a "admin"
export const HTTP_ADMIN = "http://admin:admin@";

// ---------------------------------------- Variables que deberían ser constantes ----------------------------------------

/* Mientras se hacen las pruebas de la aplicación, el servidor remoto de pruebas puede no tener un nombre de dominio asociado, y por ende
   hay que usar su dirección IP, no un nombre. El problema es que la IP puede ser dinámica, lo que significa que cambia cada vez que
   se apaga y se vuelve a prender el servidor. Por eso dejamos provisionalmente algunas de las siguientes no como constantes sino
   como variables que pueden cambiar dependiendo de la IP que el usuario ingrese en la ventana "Settings.js" */

// Dirección IP pública del servidor (no colocar la privada porque entonces sólo sería posible la conexión si se estuviese en la misma red)
export var SERVER_IP = null;

/* URL para acceder al servidor PouchDB que tiene Lithodex. A esto hay que concatenarle luego el nombre de la base de datos correspondiente, ya que allí hay varias

  Como puede observarse, por el momento siempre accedemos a través de un usuario "admin" cuya clave también es "admin"; por eso al principio de la URL ponemos
  "admin:admin". Ingresando allí tenemos acceso a todas las bases de datos, cada una de las cuales almacena los datos de un usuario específico.
  Pero también podría hacerse que en la URL se coloque el nombre de usuario y la contraseña del usuario respectivo, y así sólo se verían las bases de datos
  correspondientes a él */
export var SERVER_URL = HTTP_ADMIN + SERVER_IP + ":" + SERVER_PORT + "/";

// Dirección en la que se encuentra la base de datos con información genérica de Lithodex
export var REMOTE_GENERIC_LITHODEX = SERVER_URL + "lithodex_generic";

// Base de datos remota de Lithodex, que se encuentra en el servidor. Es remota para el usuario común
export var remoteLithodex = new PouchDB(REMOTE_GENERIC_LITHODEX);

// Función provisional para cambiar las variables anteriores de acuerdo a la IP ingresada
export function changeServerIp(newIp){
	SERVER_IP = newIp;
	SERVER_URL = HTTP_ADMIN + newIp + ":" + SERVER_PORT + "/";
	REMOTE_GENERIC_LITHODEX = SERVER_URL + "lithodex_generic";
	remoteLithodex = new PouchDB(REMOTE_GENERIC_LITHODEX);
}

// -------------------------------------- Nombres de bases de datos -------------------------------------------

// Nombre de la base de datos que se aloja en el dispositivo para almacenar información general, como quién es el usuario
// activo en la aplicación, el idioma que se está empleando, el log, etc.
export const LOCAL_LITHODEX = 'lithodex_local';

// ------------------------------------- Identificadores de usuarios ------------------------------------------

// Identificador del usuario no autenticado
export const UNAUTHENTICATED_ID = 'unauthenticated';

// Identificador del primer usuario administrador
export const PRIMARY_ADMINISTRATOR_ID = '===?¡18jswi..__q173x5gbxjf(()459jdcj';

// -------------------------- Identificadores de documentos dentro de las bases de datos-----------------------

// Las bases de datos de los usuarios tienen un documento principal de nombre <DEFAULT_DOCUMENT_ID>.
// Allí se almacena la información del usuario, los privilegios y las solicitudes de amistad.
// También se le llama <DEFAULT_DOCUMENT_ID> al documento que tiene la base de datos LOCAL_LITHODEX
export const DEFAULT_DOCUMENT_ID = 'general_document';

// Documento de REMOTE_GENERIC_LITHODEX en donde se clasifica a los usuarios tanto por nombre como por sus identificadores.
// La decisión de incluir ambas clasificaciones en uno solo es que así podemos garantizar que si falla la actualización del documento,
// falla la actualización de ambas tablas, por lo que no es necesario deshacer cambios si en una sí se pudo hacer y en la otra no.
export const USERS_TABLES_DOCUMENT_ID = "users_tables_document";

// Documento de REMOTE_GENERIC_LITHODEX en donde se encuentra información relativa a cada uno de los usuarios, clasificada según los identificadores de los usuarios
export const USERIDS_DOCUMENT_ID = "userIds_document";

// Documento de REMOTE_GENERIC_LITHODEX en donde están las acciones que deben registarse de todos los usuarios
export const LOG_DOCUMENT_ID = "log_document";

// Documento de la base de datos de un usuario en el que se guardan sus afloramientos
export const OUTCROPS_DOCUMENT_ID = "outcrops_document";

// Documento de la base de datos de un usuario en el que se guardan sus núcleos
export const CORES_DOCUMENT_ID = "cores_document";

// Lista de documentos que siempre tienen que estar presentes en la base de datos de un usuario
export const USER_COMMON_DOCUMENT_IDS = [DEFAULT_DOCUMENT_ID, OUTCROPS_DOCUMENT_ID, CORES_DOCUMENT_ID];