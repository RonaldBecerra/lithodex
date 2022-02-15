import publicIP from 'react-native-public-ip'
import * as Location from 'expo-location'
import * as Permissions from 'expo-permissions'
import * as Network from 'expo-network'
import { UNAUTHENTICATED_ID, DEFAULT_DOCUMENT_ID, OUTCROPS_DOCUMENT_ID, CORES_DOCUMENT_ID,
		 LOCAL_LITHODEX, remoteLithodex, LOG_DOCUMENT_ID, USER_COMMON_DOCUMENT_IDS } from '../constants/appConstants'
import {deleteConflictingRevisions} from './databaseFunctions'

import PouchDB from 'pouchdb-react-native'
PouchDB.plugin(require('pouchdb-adapter-asyncstorage').default);

import {Platform} from 'react-native';

/* Aquí almacenamos todas las acciones posibles que se pueden registrar, incluyendo tanto las que sólo se guardan en la base de datos local del usuario
   como las que se guardan en la base de datos remota global para todos los usuarios */
const ALL_ACTIONS = {
	1: 'open_app', // Abrimos la aplicación
	2: 'open_settings', // Abrimos la ventana de configuración
	3: 'open_about_lithodex', // Abrimos la ventana de información de LithoDex
	4: 'open_objectOfStudy_gallery', // Abrimos la ventana de galería de un objeto de estudio
	5: 'open_add_new_objectOfStudy', // Abrimos la ventana para añadir un nuevo onjeto de estudio, pero todavía no lo hemos salvado
	6: 'add_new_objectOfStudy', // Salvamos un nuevo objeto de estudio
	7: 'open_edit_objectOfStudy', // Abrimos la ventana para modificar la información de un objeto de estudio ya existente, pero todavía no hemos salvado cambios
	8: 'edit_objectOfStudy', // Salvamos la modificación de un objeto de estudio
	9: 'delete_objectOfStudy', // Borramos un objeto de estudio que había sido creado
	10: 'open_objectOfStudy_screen', // Abrimos la ventana en la que se muestra la columna estratigráfica del objeto de estudio, y también las gráficas, en caso de tratarse de un núcleo
	11: 'open_add_new_stratum', // Abrimos la ventana en la que se añade un nuevo estrato 
	12: 'add_new_stratum', // Salvamos un nuevo estrato
	13: 'open_edit_stratum', // Abrimos la ventana para editar la información de un estrato
	14: 'edit_stratum', // Salvamos la modificación de un estrato
	15: 'delete_stratum', // Borramos un estrato que había sido creado
	16: 'open_lithology_screen_new', // Abrimos la ventana de litología cuando todavía no se ha añadido ninguna litología
	17: 'open_lithology_screen_again', // Abrimos la ventana de litología cuando ya se ha añadido alguna litología para el estrato correspondiente
	18: 'open_structure_screen_new', // Abrimos la ventana de estructura sedimentaria cuando todavía no se ha añadido ninguna estructura
	19: 'open_structure_screen_again', // Abrimos la ventana de estructura sedimentaria cuando ya se ha añadido alguna estructura para el estrato correspondiente
	20: 'open_fossil_screen_new', // Abrimos la ventana de fósiles cuando todavía no se ha añadido ningún fósil
	21: 'open_fossil_screen_again', // Abrimos la ventana de fósiles cuando ya se ha añadido algún fósil para el estrato correspondiente
	22: 'open_stratum_image_screen_new', // Abrimos la ventana de selección de imágenes de un estrato cuando todavía no se ha añadido ninguna imagen
	23: 'open_stratum_image_screen_again', // Abrimos la ventana de selección de imágenes de un estrato cuando ya se añadido alguna imagen para el estrato correspondiente
	24: 'open_user_registration', // Abrimos la ventana en la que un usuario se registra
	25: 'open_user_edit', // Abrimos el formulario de usuario para editar la información de un usuario ya existente
}

/* Aquí sólo incluimos aquellas acciones que deben almacenarse en la base de datos remota global para todos los usuarios
  (Las que están aquí son una copia de las que ya habíamos incluido en "ALL_ACTIONS")

  Por ahora, estas acciones sólo corresponden a operaciones sobre afloramientos o núcleos, y
  nunca son llamadas desde un archivo de vista sino desde el documento "databaseFuntions.js" */
const ACTIONS_TO_STORE_REMOTELY = {
	6: 'add_new_objectOfStudy', // Salvamos un nuevo objeto de estudio
	8: 'edit_objectOfStudy', // Salvamos la modificación de un objeto de estudio
	9: 'delete_objectOfStudy', // Borramos un objeto de estudio que había sido creado
	12: 'add_new_stratum', // Salvamos un nuevo estrato
	14: 'edit_stratum', // Salvamos la modificación de un estrato
	15: 'delete_stratum', // Borramos un estrato que había sido creado
}

// Base de datos local genérica (no la de un usuario particular)
const localLithodex = new PouchDB(LOCAL_LITHODEX, {auto_compaction: true, revs_limit: 1}); 

/* Función para registrar todos los tipos de acciones
   El parámetro "doAction" es provisional, y es para hacer que la función haga algo o no mientras la aplicación está en prueba

   Esta forma de recibir parámetros a través de objetos permite que las otras funciones que invocan a ésta no tengan que preocuparse de conocer el orden de los mismos, 
   y poner el "= {}" permite omitir parámetros a los cuales se les quiere dejar sus valores por defecto:
   
   https://stackoverflow.com/questions/894860/set-a-default-parameter-value-for-a-javascript-function
*/
export async function log_action({entry_code=null, user_id=null, isCore=null, object_id=null, stratum_key=null, doAction=true, localDB=null} = {}) {
	if (doAction) {
		const current_time = new Date().getTime();
		var log_entry = {
			time:   current_time,
			action: ALL_ACTIONS[entry_code],
			code:   entry_code,
			os:     Platform.Version,
		}

		// Añadimos los siguientes valores como propiedades del registro sólo cuando no son nulos
		if (isCore != null) {
			log_entry.objectOfStudy_type = (isCore ? 'core' : 'outcrop');
		}
		if (object_id != null) {
			log_entry.objectOfStudy_id = object_id;
		}
		if (stratum_key != null) {
			log_entry.stratum_key = stratum_key;
		}

		// Salvamos la entrada de log en la base de datos local genérica
		// Esta entrada servirá en el futuro para determinar si el usuario tiene dificultades con el manejo de la aplicación
		await localLithodex.get(DEFAULT_DOCUMENT_ID)
			.then(async function(document){
				let cu = document.currentUser;
				await cu.log.push(log_entry);
				if (cu.log_length > 99){
					cu.log.shift();
				} else {
					cu.log_length += 1;
				}
				return localLithodex.put({...document, _rev: document._rev});
				}).catch(function (error){
					console.error(error.toString());
				})

		// En caso de que la acción sea del tipo que amerita registrarse en la base de datos genérica remota, primero salvamos el registro
		// en el documento correspondiente de la base de datos del usuario, por si acaso se pierde la conexión y no da tiempo de guardarlo en la remota,
		// y una vez que esté allí es que se intenta transferirlo a la remota.
		if (ACTIONS_TO_STORE_REMOTELY[entry_code] != null){
			log_entry = {
				...log_entry,
				time: current_time,
				user_id,
			}
			// Recuérdese que por ahora las acciones que deben almacenarse en la base de datos remota genérica
			// son sólo las correspondientes a objetos de estudio (núcleos o afloramientos)
			const document_name = (isCore ? CORES_DOCUMENT_ID : OUTCROPS_DOCUMENT_ID);
			let logToReturn = null;
			await localDB.get(document_name)
				.then(async function(document){
					logToReturn = document.log;
					if (user_id === UNAUTHENTICATED_ID){
						switch(entry_code){
							// Si estamos trabajando con el usuario no autenticado y se elimina el objeto de estudio,
							// no nos interesa mantener los registros correspondientes a él, ya que es como si nunca
							// hubiese existido.
							case 9: 
								logToReturn = await logToReturn.filter(function(log_entry){
									return (log_entry.objectOfStudy_id !== object_id);
								});
								break;

							// De igual manera, si se elimina un estrato de ese objeto de estudio, 
							// no nos interesa manetener los registros correspondientes a dicho estrato
							case 15:
								logToReturn = await logToReturn.filter(function(log_entry){
									return ((log_entry.objectOfStudy_id !== object_id) || (log_entry.stratum_key !== stratum_key));
								});
								break;

							default:
								document.log.push(log_entry);
								break;
						}
					}
					else {
						logToReturn.push(log_entry);
					}
				})
				.catch(function (error){
					console.error(error.toString());
				})
			return logToReturn;
		}
	}
}

// Función para transferir los registros de log del usuario necesarios a la base de datos remota genérica de todos los usuarios
export async function exportLogEntries(user_id, userDB){
	// Primero eliminamos las posibles versiones conflictivas de los documentos
	await deleteConflictingRevisions(userDB, USER_COMMON_DOCUMENT_IDS);

	// Documentos que tienen log
	let outcropsDocument = await userDB.get(OUTCROPS_DOCUMENT_ID);
	let coresDocument    = await userDB.get(CORES_DOCUMENT_ID);

	let totalLog = await outcropsDocument.log.concat(coresDocument.log);
	let len    = totalLog.length;

	let i = 0; // Intentos que se han realizado de exportar el log
	let noErrors = false;

	while ((i < 5) && (len > 0)){
		// Ordenamos el log obtenido de manera cronológica
		await totalLog.sort((a, b) => (a.time < b.time) ? 1 : -1);

		try{
			// Determinamos la dirección ip del usuario
			let user_ip = await publicIP();

			// Determinamos la localización geográfica del usuario
			let { status } = await Permissions.askAsync(Permissions.LOCATION);
			if (status !== 'granted') {
				var longitude = 'Undetermined';
				var latitude  = 'Undetermined';
			}
			else {
				const geographicLocation = await Location.getCurrentPositionAsync({enableHighAccuracy: true});
				var longitude = JSON.stringify(geographicLocation.coords.longitude);
				var latitude  = JSON.stringify(geographicLocation.coords.latitude);
			}

			let log_entry = null;
			let k;

			for (k=0; k < len; k++){
				log_entry = totalLog[k];

				// Añadimos los valores faltantes que sean necesarios
				if (log_entry["user_ip"] == null){
					log_entry["user_ip"] = user_ip;
				}
				if (log_entry["latitude"] == null){
					log_entry["latitude"] = latitude;
					log_entry["longitude"] = longitude;
				}
				if (log_entry["user_id"] === UNAUTHENTICATED_ID){
					log_entry["user_id"] = user_id;
				}
				log_entry["iteración"] = i;
			}
			let remoteDocument = await remoteLithodex.get(LOG_DOCUMENT_ID);
			remoteDocument.log = await remoteDocument.log.concat(totalLog);
			console.log("\nAl hacer put, totalLog = ", totalLog);
			await remoteLithodex.put({...remoteDocument, _rev: remoteDocument._rev});
			noErrors = true;
			break;
		}
		catch(error){
			i += 1;

			// Realizamos todas estas operaciones otra vez, porque es posible que desde otro dispositivo se hayan realizado cambios, como haber exportado ya el log
			await deleteConflictingRevisions(userDB, USER_COMMON_DOCUMENT_IDS);
			outcropsDocument = await userDB.get(OUTCROPS_DOCUMENT_ID);
			coresDocument    = await userDB.get(CORES_DOCUMENT_ID);

			totalLog = await outcropsDocument.log.concat(coresDocument.log);
			len = totalLog.length;
		}
	}

	if (noErrors){
		outcropsDocument.log = [];
		coresDocument.log    = [];
		try{
			userDB.put({...outcropsDocument, _rev: outcropsDocument._rev});
			userDB.put({...coresDocument, _rev: coresDocument._rev});
		}
		catch(error){
			console.error("logFunctions, exportLogEntries ", error.toString());
		}
	}
}

// Función para transferir los registros de log del usuario necesarios a la base de datos remota genérica de todos los usuarios
// export async function exportLogEntries(user_id, userDB){
// 	// Primero eliminamos las posibles versiones conflictivas de los documentos
// 	await deleteConflictingRevisions(userDB, USER_COMMON_DOCUMENT_IDS);

// 	// Documentos que tienen log
// 	let outcropsDocument = await userDB.get(OUTCROPS_DOCUMENT_ID);
// 	let coresDocument    = await userDB.get(CORES_DOCUMENT_ID);

// 	let totalLog = await outcropsDocument.log.concat(coresDocument.log);
// 	const len    = totalLog.length;

// 	if (len > 0){
// 		// Ordenamos el log obtenido de manera cronológica
// 		await totalLog.sort((a, b) => (a.time < b.time) ? 1 : -1);

// 		let i = 0; // Intentos que se han realizado de exportar el log
// 		let noErrors = false;
// 		while (i < 5){
// 			try{
// 				// Determinamos la dirección ip del usuario
// 				let user_ip = await publicIP();

// 				// Determinamos la localización geográfica del usuario
// 				let { status } = await Permissions.askAsync(Permissions.LOCATION);
// 				if (status !== 'granted') {
// 					var longitude = 'Undetermined';
// 					var latitude  = 'Undetermined';
// 				}
// 				else {
// 					const geographicLocation = await Location.getCurrentPositionAsync({enableHighAccuracy: true});
// 					var longitude = JSON.stringify(geographicLocation.coords.longitude);
// 					var latitude  = JSON.stringify(geographicLocation.coords.latitude);
// 				}

// 				let log_entry = null;
// 				let k;

// 				for (k=0; k < len; k++){
// 					log_entry = totalLog[k];

// 					// Añadimos los valores faltantes que sean necesarios
// 					if (log_entry["user_ip"] == null){
// 						log_entry["user_ip"] = user_ip;
// 					}
// 					if (log_entry["latitude"] == null){
// 						log_entry["latitude"] = latitude;
// 						log_entry["longitude"] = longitude;
// 					}
// 					if (log_entry["user_id"] === UNAUTHENTICATED_ID){
// 						log_entry["user_id"] = user_id;
// 					}
// 					log_entry["iteración"] = i;
// 				}
// 				let remoteDocument = await remoteLithodex.get(LOG_DOCUMENT_ID);
// 				remoteDocument.log = await remoteDocument.log.concat(totalLog);
// 				await remoteLithodex.put({...remoteDocument, _rev: remoteDocument._rev});
// 				noErrors = true;
// 				break;
// 			}
// 			catch(error){
// 				i += 1;
// 			}
// 		}

// 		if (noErrors){
// 			outcropsDocument.log = [];
// 			coresDocument.log    = [];
// 			try{
// 				userDB.put({...outcropsDocument, _rev: outcropsDocument._rev});
// 				userDB.put({...coresDocument, _rev: coresDocument._rev});
// 			}
// 			catch(error){
// 				console.error("logFunctions, exportLogEntries ", error.toString());
// 			}
// 		}
// 	}
// }