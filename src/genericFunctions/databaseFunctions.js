import PouchDB  from 'pouchdb-react-native'
import * as Log from './logFunctions'
import * as appConstants from '../constants/appConstants'
import { orderObject } from './otherFunctions'

import _ from "lodash"

PouchDB.plugin(require('pouchdb-adapter-asyncstorage').default);

/* En la siguiente página se puede ver la lista de posibles errores que puede lanzar PouchDB
   https://github.com/pouchdb/pouchdb/blob/master/packages/node_modules/pouchdb-errors/src/index.js
*/

// Estructura del documento que tendrá cada usuario, el cual almacena los afloramientos
const OUTCROPS_DOCUMENT = {  
	_id:     appConstants.OUTCROPS_DOCUMENT_ID,
	objects: {},
	log:     [], // Mientras el usuario no esté autenticado, en este log registraremos las accciones que deberían incluirse en
		         // el log de la base de datos remota con información común para todos los usuarios. Cuando el usuario inicie sesión,
		         // añadimos estos registros a esa base de datos remota
} 

// Estructura del documento que tendrá cada usuario, el cual almacena los núcleos
const CORES_DOCUMENT = {  
	_id:     appConstants.CORES_DOCUMENT_ID,
	objects: {},
	log:     [], // Mientras el usuario no esté autenticado, en este log registraremos las accciones que deberían incluirse en
		         // el log de la base de datos remota con información común para todos los usuarios. Cuando el usuario inicie sesión,
		         // añadimos estos registros a esa base de datos remota
} 

// Propiedades del usuario no autenticado que interesa conocer en la base de datos local genérica
const UNAUTHENTICATED_PROPERTIES = { 
	_id:          appConstants.UNAUTHENTICATED_ID,
	privileges:   0,
	profileImage: null,
	log:          [], // Log personal que sirve para que la aplicación detecte si el usuario tiene dificultades con su manejo
	log_length:   0, // Tamaño del "log"
}

// Propiedades que siempre son iguales en un usuario que se está registrando
const NEW_USER_PROPERTIES = {
	_id:            appConstants.DEFAULT_DOCUMENT_ID,
	userName:       null, // Nombre de usuario, que no necesariamente es el mismo real de la persona
	privileges:     0,
	friends:        {}, // Objeto que funciona como lista de identificadores de usuario de los que son amigos del actual. El nombre de la propiedad es el identificador, y el valor será "true"
	friendRequests: {received: {}, made: {}}, /* Solicitudes de amistad. El objeto "received" almacena los identificadores de usuario de quienes le han enviado solicitud al actual,
								                 y el objeto "made" almacena los de quienes el actual les ha enviado solicitud */
}

// Creamos la base de datos con la información general. Ella permite que al volver abrir la aplicación se sigan usando algunos parámetros que se
// habían dejado antes de cerrarla, como cuál es el usuario que estaba activo y cuál es el idioma actual en la aplicación
const localLithodex = new PouchDB(appConstants.LOCAL_LITHODEX, {auto_compaction: true, revs_limit: 1}); 

// Creamos la base de datos con la información salvada por el usuario mientras no inicie sesión
const unauthenticatedDB = new PouchDB(appConstants.UNAUTHENTICATED_ID); 

// Esta función se llama cuando no se ha creado ninguna base de datos
export async function dummy_database() {
	await localLithodex.put({
		_id:      appConstants.DEFAULT_DOCUMENT_ID, 
		language: 'spanish', // El idioma por defecto es el español en esta aplicación
		serverIp: null, /* Dirección ip del servidor remoto. Se salva aquí para recuperarla cuando el usuario cierre y vuelva a abrir la aplicación.
		                   Recuérdese que esto sólo es necesario mientras tengamos que acceder al servidor a través de una ip que podría variar, y no
		                   a través de un nombre de dominio fijo */
		currentUser: {...UNAUTHENTICATED_PROPERTIES}, // Datos del usuario que actualmente usando la aplicación en el dispositivo
	}).catch(function (error){
		console.error("databaseFunctions, dummy_database (1) ", error.toString());
	});


	/* La base de datos de cada usuario debe tener al menos tres documentos básicos: 
	 * 1) el de información general, 
	 * 2) el de los núcleos,
	 * 3) el de los afloramientos.
	 *
	 * El de información general no parece ser necesario por ahora para el usuario no autenticado,
	 * pero lo incluimos por si acaso
	 */

	await unauthenticatedDB.bulkDocs([
		{ // Documento de información general
			_id:         appConstants.DEFAULT_DOCUMENT_ID,
			privileges:  0, // El privilegio 0 es el de un usuario normal
		},
		{...OUTCROPS_DOCUMENT}, // Documento con los afloramientos
		{...CORES_DOCUMENT}, // Documento con los núcleos
	]).catch(function (error){
		console.error("databaseFunctions, dummy_database (2)", error.toString());
	});

	return true;
}

// Esta función es utilizada por el archivo "App.js"
export async function new_database() {
	await localLithodex.get(appConstants.DEFAULT_DOCUMENT_ID)
		.then(() => {
			return true;
		})
		.catch(e => {
			// Si da error es porque no había una base de datos local de Lithodex en la memoria del dispositivo, así que la creamos
			return dummy_database();
		});
}

// Función utilizada por MainMenu.js para cerrar la sesión de un usuario y así volver al modo de usuario no autenticado
export function logOut(){
	localLithodex.get(appConstants.DEFAULT_DOCUMENT_ID)
		.then(function(document){
			// Hacemos que la información del usuario actual vuelva a ser la genérica de uno no autenticado
			document.currentUser = {...UNAUTHENTICATED_PROPERTIES};
			return localLithodex.put({...document, _rev: document._rev});
		})
		.catch(function (error){
			console.error("databaseFunctions, logOut ", error.toString());
		})	
}

// Función utilizada por el archivo UserForm.js para crear o actualizar los datos personales de un usuario
// OJO: ******** Esta función debería implementarse con exclusión mutua, lo cual todavía no sé hacer *************
export async function saveUserInfo(payload, localUserDB, isNew, acquireInformation) {
	let {_id, information, userName, password} = payload;

	// Esta variable determina si ocurrió un error o no durante la ejecución de esta función, pero sólo estamos tomando en cuenta los que tienen que
	// ver con la base de datos remota genérica; no registramos como error si por ejemplo o logra adquirirse toda la información del usuario no autenticado,
	// porque si algo sale mal a mitad de ejecución es difícil revertir todos los cambios
	let noError = true; 

	// Función para order

	if (isNew){
		// En la base de datos remota genérica salvamos el nombre del nuevo usuario en la tabla en la que se clasifican los usuarios por sus nombres de usuario
		await appConstants.remoteLithodex.get(appConstants.USERS_TABLES_DOCUMENT_ID)
			.then(async function(document){
				// Caso en que ya otro usuario está utilizando ese mismo nombre
				if (document.userNames.hasOwnProperty(userName)){
					noError = false;
				} else {
					document.userIds[_id]        = {userName};  // Tabla ordenada por identificadores.
					document.userNames[userName] = await {_id}; // Tabla ordenada por nombres de usuario

					document.userNames = await orderObject(document.userNames); // Ordenamos la tabla indexada por nombres
					document.userIds   = await orderObject(document.userIds);   // Ordenamos la tabla indexada por identificadores

					return appConstants.remoteLithodex.put({...document, _rev: document._rev});
				}
			}).catch(function (error){
				noError = false;
			})

		if (noError){	
			// Documento con información general del usuario (nótese que dejamos casi todas las propiedades dentro de una sola más externa
			// llamada "information". Las que dejamos afuera de ella son "userName", "password" y las de NEW_USER_PROPERTIES).
			const newUserDefaultDocument = {  
				...NEW_USER_PROPERTIES,
				information, userName, password, // Información obtenida del payload
			} 
			const newUserOutcropsDocument = {...OUTCROPS_DOCUMENT} // Documento que almacena los afloramientos salvados por el usuario
			const newUserCoresDocument = {...CORES_DOCUMENT} // Documento que almacena los núcleos salvados por el usuario

			// Caso en que se desea que el nuevo usuario adquiera la información del usuario no autenticado
			// Esa información se elimina del usuario no autenticado, y se deja sólo en la base de datos del nuevo usuario
			if (acquireInformation){

				// Adquirimos los afloramientos
				await unauthenticatedDB.get(appConstants.OUTCROPS_DOCUMENT_ID)
					.then(async function(document){ 
						newUserOutcropsDocument.objects = await document.objects;
						document.objects = {};

						unauthenticatedDB.put({...document, _rev: document._rev});
					}).catch(function (error){
						console.error("databaseFunctions, saveUserInfo (1) ", error.toString());
					})

				// Adquirimos los núcleos
				await unauthenticatedDB.get(appConstants.CORES_DOCUMENT_ID)
					.then(async function(document){ 
						newUserCoresDocument.objects = await document.objects;
						document.objects = {};

						unauthenticatedDB.put({...document, _rev: document._rev});
					}).catch(function (error){
						console.error("databaseFunctions, saveUserInfo (2) ", error.toString());
					})

				// Adquirimos los documentos referentes a imágenes
				await acquireUnauthenticatedImages(localUserDB)

				// Hacemos que las entradas de log que se habían registrado en la base de datos del usuario no autenticado se transfieran a la remota
				Log.exportLogEntries(_id, unauthenticatedDB);
			}

			// Salvamos la información del nuevo usuario en su base de datos local
			await localUserDB.bulkDocs([newUserDefaultDocument, newUserOutcropsDocument, newUserCoresDocument]);
		}
	} 
	else { // Caso en que estamos modificando la información de un usuario ya creado
		await localUserDB.get(appConstants.DEFAULT_DOCUMENT_ID)
			.then(async function(document){  
				let {friends, friendRequests, privileges} = document;

				// Caso en que el nombre de usuario cambió
				if (document.userName != userName) {
					await appConstants.remoteLithodex.get(appConstants.USERS_TABLES_DOCUMENT_ID)
						.then(async function(remote_document){
							// Caso en que ya otro usuario está utilizando ese mismo nombre
							if (remote_document.userNames.hasOwnProperty(userName)){
								noError = false;
							}
							else {
								delete remote_document.userNames[document.userName];
								remote_document.userNames[userName]._id = _id; // Tabla ordenada por nombres de usuario.
								remote_document.userIds[_id].userName   = userName; // Tabla ordenada por identificadores.
								remote_document.userNames = await orderObject(remote_document.userNames); 
								return appConstants.remoteLithodex.put({...remote_document, _rev: remote_document._rev});
							}	 					
						}).catch(function(error){
							noError = false;
						})
				}
				if (noError){
					document.information = information;
					document.userName    = userName;
					document.password    = password;
					return localUserDB.put({...document, _rev: document._rev});
				}
			}).catch(function (error){
				console.error("databaseFunctions, saveUserInfo (3) ", error.toString());
			})	
	}	

	if (noError){
		// Si todo se ejecutó correctamente, en la base de datos local genérica indicamos que el usuario actual es el que 
		// se acaba de registrar, o si ya estaba registrado, indicamos los nuevos datos pertinentes.
		await localLithodex.get(appConstants.DEFAULT_DOCUMENT_ID)
			.then(function(document){
				document.currentUser._id          = _id;
				document.currentUser.profileImage = information.profileImage;
				document.currentUser.userName     = userName;
				return localLithodex.put({...document, _rev: document._rev});
			}).catch(function (error){
				console.error("databaseFunctions, saveUserInfo (4) ", error.toString());
			})
	}

	// Devolvemos el valor opuesto de "noError", porque la verificación que se hará después es sobre el valor verdadero
	return !noError;
}

// Función utilizada tanto por la función de este mismo archivo "saveUserInfo" como por el archivo Login.js para transferir 
// todos los documentos referentes a imágenes almacenados en la base de datos del usuario no autenticado, 
// a la base de datos del usuario que acaba de autenticarse.
export async function acquireUnauthenticatedImages(localDB){
	const aC = appConstants;

	const docs = await unauthenticatedDB.allDocs({include_docs: false}); // Excluimos los contenidos de los documentos porque lo único que nos interesa son sus identificadores
	const rows = docs.rows;

	let id;
	for (i=0; i<rows.length; i++){
		// Nótese que aquí no se pone "._id" sino ".id". También podría haberse puesto "Key", o incluso ".doc._id" si hubiésemos incluido 
		// los documentos propiamente en la instrucción "allDocs()".
		id = rows[i].id; 
		if (!aC.USER_COMMON_DOCUMENT_IDS.includes(id)){ // El arreglo "aC.USER_COMMON_DOCUMENT_IDS" tiene la lista de los identificadores de documentos que no son imágenes
			await unauthenticatedDB.get(id)
				.then(async function(document){	
					let base64 = document.base64;	
					// Las siguientes dos funciones están definidas en este mismo archivo
					await storeImage(base64, id, localDB);
					deleteImage(id, unauthenticatedDB);
				})
				.catch(function(error){
					console.error("databaseFunctions, acquireUnauthenticatedImages ", error.toString());
				})
		}
	}
}

// Función utilizada por Settings.js para eliminar un usuario del sistema 
export async function deleteUser(user_id, userName, remoteDB, localDB=null){
	let error = false;

	try{
		// Obtenemos el documento que será actualizado de la base de datos remota genérica de Lithodex
		let usersTables_document = await appConstants.remoteLithodex.get(appConstants.USERS_TABLES_DOCUMENT_ID);

		// Borramos al usuario de las dos tablas de usuario
		await delete usersTables_document.userIds[user_id];
		await delete usersTables_document.userNames[userName];
		
		// Salvamos los cambios
		appConstants.remoteLithodex.put({...usersTables_document, _rev: usersTables_document._rev});

		// Destruimos las bases de datos
		remoteDB.destroy();

		if (null !== localDB){
			localDB.destroy();
		}

		// En la base de datos local de Lithodex, hacemos que el usuario actual sea nuevamente el no autenticado
		logOut();

	} catch(e){
		console.error("deleteOwnUser error = ", e.toString());
		error = true;
	}
	return error;
}

/* Función utilizada por el archivo UserView.js. La acción que realiza depende del valor de "kind"

	* Si kind = 0, un usuario le está haciendo una solicitud de amistad a otro.
	* Si kind = 1, se está eliminando una solicitud de amistad, independientemente de si fue el mismo que la había hecho que la canceló, o el otro se la rechazó.
	* Si kind = 2, se está aprobando una solicitud de amistad.
	* Si kind = 3, se está eliminando a otro usuario de la lista de amigos

	OJO: ******** Esta función debería implementarse con exclusión mutua, lo cual todavía no sé hacer *************
*/
export async function updateRelationship(source_id, destination_id, source_database, destination_database, kind) {
	let result = {
		noError:    true, // Indica si ocurrió un error durante la ejecución de esta función
		originalOp: true, /* Indica si la operación que se realizó era la que se quería originalmente. Esto podría ser falso si por ejemplo se iba a hacer una solicitud de amistad, y
		                     la otra persona también la había solicitado después de que el sistema hiciera la última comprobación. En ese caso ambos se harán amigos directamente y, por lo
		                     tanto, la operación resultante no es la que se quería hacer al principio */
	}

	await source_database.get(appConstants.DEFAULT_DOCUMENT_ID)
		.then(async function(sourceUser_doc){ 
			await destination_database.get(appConstants.DEFAULT_DOCUMENT_ID)
				.then(async function(destinationUser_doc){
					if (kind == 0){ // Caso en que un usuario le hace una solicitud de amistad a otro

						// Si el otro usuario también le había hecho una solicitud al actual después de la última vez que el sistema revisó las solicitudes,
						// entonces convertimos a ambos en amigos de una vez
						if (destinationUser_doc.friendRequests.made[source_id]){
							delete destinationUser_doc.friendRequests.made[source_id];

							sourceUser_doc.friends[destination_id] = true;
							destinationUser_doc.friends[source_id] = true;

							destinationUser_doc.friends = await orderObject(destinationUser_doc.friends);

							result.originalOp = false;
						}
						else {
							sourceUser_doc.friendRequests.made[destination_id] = true;
							destinationUser_doc.friendRequests.received[source_id] = true;
						}
					}	
					else if (kind < 3){ 

						// Caso en que tenemos que aprobar una solicitud de amistad
						if (kind == 2){
							
							if (sourceUser_doc.friendRequests.made[destination_id]){
								sourceUser_doc.friends[destination_id] = true;
								destinationUser_doc.friends[source_id] = true;

								sourceUser_doc.friends      = await orderObject(sourceUser_doc.friends);
								destinationUser_doc.friends = await orderObject(destinationUser_doc.friends);
							}
							else { // Es posible que el usuario que había solicitado la amistad la haya cancelado justo cuando el actual iba a aprobarla
								result.originalOp = false; // No se ejecuta ninguna acción
							}
						}

						// Tanto si kind es 1 como si es 2, tenemos que eliminar a los usuarios de las listas de solicitudes pendientes
						delete sourceUser_doc.friendRequests.made[destination_id];
						delete destinationUser_doc.friendRequests.received[source_id];

						// Esto es por si acaso el usuario destino también había realizado una solicitud después de que el sistema revisó por última vez las solicitudes
						// (El "delete" no ejecuta ninguna acción si la propiedad no estaba presente)
						delete sourceUser_doc.friendRequests.received[destination_id];
						delete destinationUser_doc.friendRequests.made[source_id];

						// También por si acaso se habían hecho amigos justo antes de que al actual le diera tiempo de cancelar la solicitud
						if (kind == 1){
							delete sourceUser_doc.friends[destination_id];
							delete destinationUser_doc.friends[source_id];
						}

					} else { // Caso en que los dos usuarios dejan de ser amigos
						delete sourceUser_doc.friends[destination_id];
						delete destinationUser_doc.friends[source_id];
					}
					
					return destination_database.put({...destinationUser_doc, _rev: destinationUser_doc._rev});
				}).catch(function (error){
					result.noError = false;
				})

			return source_database.put({...sourceUser_doc, _rev: sourceUser_doc._rev});
		}).catch(function (error){
			result.noError = false;
		})
	return result;
}

// Para conceder o quitar el privilegio de ser administrador. Nótese que un administrador se puede quitar el privilegio a sí mismo, y 
// también se lo puede quitar a otros administradores, menos al primario, que es el que viene por defecto en la aplicación.
// También nótese que esto no toma en cuenta el privilegio de valor 1, que no está implementado actualmente pero podría en el futuro
export async function changeAdminPrivileges(newPrivileges, remoteDB){
	let noError = true;

	await remoteDB.get(appConstants.DEFAULT_DOCUMENT_ID)
		.then(function(document){
			document.privileges = newPrivileges;
			return remoteDB.put({...document, _rev: document._rev});
		})
		.catch(function(error){
			noError = false;
		})
	return noError;
}

// Función utilizada por el archivo ObjectForm.js para crear o actualizar un afloramiento o un núcleo
export async function saveObjectOfStudyInfo(payload, isCore, isNew, user_id, object_id, localDB) {
	await localDB.get((isCore ? appConstants.CORES_DOCUMENT_ID : appConstants.OUTCROPS_DOCUMENT_ID))
		.then(async function(document){ 
			// Primero obtenemos el nuevo "log" a añadir
			let newLog = null;

			if (isNew){
				newLog = await Log.log_action({entry_code: 6, user_id, isCore, object_id, localDB});
			}
			else {
				if (isCore && payload.gammaRayValues_changed){
					newLog = await Log.log_action({entry_code: 8, user_id, isCore, object_id, localDB});
				}
				else {
					// Objeto como estaba antes del cambio
					const previousObject = document.objects[object_id];

					// Verificamos si cambió alguna propiedad de las que no tienen que ver con el ploteo, sino con
					// el objeto de estudio propiamente, porque sólo en ese caso registraremos el cambio en el log
					let arrayOfProperties = ['name', 'locationInWords', 'longitude', 'latitude', 'baseHeight'];

					if (isCore){
						let extraProperties = ['R', 'DF', 'GL', 'TVD', 'TVDFromGL', 'endHeight'];
						arrayOfProperties = arrayOfProperties.concat(extraProperties);
					}

					for (i=0; i < arrayOfProperties.length; i++){
						if (previousObject[arrayOfProperties[i]] !== payload[arrayOfProperties[i]]){
							newLog = await Log.log_action({entry_code: 8, user_id, isCore, object_id, localDB});
							break;
						}
					}
				}
			}
			
			if (null !== newLog){
				delete payload['gammaRayValues_changed']; // Esta propiedad no debe guardarse

				// Guardamos los cambios en el núcleo o afloramiento correspondiente
				document.log = await document.log.concat(newLog);
				document.objects[object_id] = await payload;
				return localDB.put({...document, _rev: document._rev});
			}
		}).catch(function (error){
			console.error("databaseFunctions, saveObjectOfStudyInfo "+ error.toString());
		})
	if (user_id !== appConstants.UNAUTHENTICATED_ID){
		Log.exportLogEntries(user_id, localDB);
	}
}

// Función utilizada por el archivo ObjectGallery.js para eliminar un afloramiento o un núcleo
export async function deleteObjectOfStudy(object_id, isCore, user_id, localDB) {
	// Primero obtenemos el nuevo "log" a añadir
	let newLog = await Log.log_action({entry_code: 9, user_id, isCore, object_id, localDB});

	if (newLog !== null){
		await localDB.get((isCore ? appConstants.CORES_DOCUMENT_ID : appConstants.OUTCROPS_DOCUMENT_ID))
			.then(async function(document){

				// Primero borramos las imágenes asociadas a los estratos del objeto de estudio
				const layerList = await document.objects[object_id].layerList;

				for (i=0; i < layerList.length; i++){
					let listOfImages = await layerList[i].image_data.listOfImages;
					if (listOfImages != null){ // image_data podría no tener la propiedad listOfImages
						for (k=0; k < listOfImages.length; k++){
							deleteImage(listOfImages[k].key, localDB);
						}
					}
				}      

				// Ahora sí borramos el objeto de estudio como tal
				delete document.objects[object_id];
				document.log = await document.log.concat(newLog);

				return localDB.put({...document, _rev: document._rev})

			}).catch(function (error){
				console.error("databaseFunctions, deleteObjectOfStudy ", error.toString());
			})
		if (user_id !== appConstants.UNAUTHENTICATED_ID){
			Log.exportLogEntries(user_id, localDB);
		}	
	}
}

// Función utilizada por ObjectStratumForm.js cuando se añade, edita o elimina un estrato,
// y también por ObjectScreen.js cuando se elimina un estrato límite (el superior o el inferior)
export async function saveLayerList(user_id, object_id, layerList, isCore, localDB, stratum_key=null, kind=null){
	/* kind puede ser: 
		0 -> Estamos agregando un estrato nuevo
		1 -> Estamos modificando un estrato ya existente
		2 -> Estamos eliminando un estrato

		kind y stratum_key son nulos cuando estamos subiendo o bajando un estrato de posición
	*/

	let newLog = null;
	if (kind != null){
		switch (kind){
			case 0: 
				newLog = await Log.log_action({entry_code: 12, user_id, isCore, object_id, stratum_key, localDB});
				break;
			case 1:
				newLog = await Log.log_action({entry_code: 14, user_id, isCore, object_id, stratum_key, localDB});
				break;
			case 2:
				newLog = await Log.log_action({entry_code: 15, user_id, isCore, object_id, stratum_key, localDB}); 
				break;
			default:
				break;
		}
	}

	if ((newLog !== null) || (kind !== null)){
		await localDB.get((isCore ? appConstants.CORES_DOCUMENT_ID : appConstants.OUTCROPS_DOCUMENT_ID))
			.then(async function(document){
				// Si estamos eliminando un estrato, primero tenemos que eliminar las imágenes asociadas a él
				if (kind == 2){
					const listOfImages = await document.objects[object_id].layerList.find(element => element.key === stratum_key).image_data.listOfImages;
					if (listOfImages != null){ // image_data podría no tener la propiedad listOfImages
						for (i=0; i<listOfImages.length; i++){
							deleteImage(listOfImages[i].key, localDB);
						} 
					}
				}

				// Guardamos la nueva lista de estratos en el núcleo o afloramiento correspondiente
				document.objects[object_id].layerList = await layerList; 

				if (kind !== null){
					document.log = await document.log.concat(newLog);
				}

				return localDB.put({...document, _rev: document._rev});
			}).catch(function (error){
				console.error("databaseFunctions, saveLayerList ", error.toString());
			})
		if (user_id !== appConstants.UNAUTHENTICATED_ID){
			Log.exportLogEntries(user_id, localDB);
		}	
	}
}

/* Esta función es utilizada por los archivos FossilPicker.js, ImagePicker.js, etc.,
   para guardar los datos que se acaban de modificar de un estrato*/
export async function saveStratumModule(user_id, object_id, index, componentKey, payload, isCore, localDB){
	let noErrors = true;
	await localDB.get((isCore ? appConstants.CORES_DOCUMENT_ID : appConstants.OUTCROPS_DOCUMENT_ID))
		.then(function(document){
			// Estrato a modificar del núcleo o afloramiento correspondiente
			const currentLayer = document.objects[object_id].layerList[index]; 

			if (componentKey.includes('lithology')){
				currentLayer.lithology_data = payload;
			} else if (componentKey.includes('structure')){
				currentLayer.structure_data = payload;
			} else if (componentKey.includes('fossil')){
				currentLayer.fossil_data    = payload;
			} else if (componentKey.includes('image')){
				currentLayer.image_data     = payload;
			} else if (componentKey.includes('note')){
				currentLayer.note_data      = payload;
			}
	
			return localDB.put({...document, _rev: document._rev})
		}).catch(function (error){
			console.error("databaseFunctions, saveStratumModule ", error.toString());
			noErrors = false;
		})
	return noErrors;
}

/* Función que salva una imagen como un nuevo documento en la base de datos del usuario
   No se pudo trabajar de la forma como se supone debería hacerse con PouchDB, que es con attachments:
   https://pouchdb.com/guides/attachments.html

   La razón es que los documentos con attachments por alguna razón no se replican cuando hay una base de datos local
   y una remota para el usuario. Recuérdese que PouchDB no sopota React Native de manera oficial, sino que se logra 
   usar gracias a terceros que empezaron a agregar adaptadores */
export async function storeImage(base64, imageKey, localDB){
	let noErrors = true;
	await localDB.get(imageKey)
		.catch(async function(error){
			// Nótese que sólo añadimos el documento si no existía, para evitar conflictos
			try{
				localDB.put({
					_id: imageKey,
					base64,
				})
			} catch(error){
				console.error("databaseFunctions, storeImage ", error.toString());
				noErrors = false;
			}
		})
	return noErrors;
}

// Función para eliminar un documento que consiste en una imagen
export async function deleteImage(imageKey, localDB){
	await localDB.get(imageKey)
		.then(async function(document){
			await delete document.base64; // Esto quizás no sea necesario
			document._deleted = true;
			return localDB.put({...document, _rev: document._rev})
		})
		.catch(function (error){
			// La imagen ya había sido borrada de otro modo
		})
}

// Función para en na base de datos eliminar las versiones conflictivas de varios documentos
export async function deleteConflictingRevisions(database, list_document_ids){
	console.log("Entré en deleteConflictingRevisions");
	let document_id, i, k;
	for (i=0; i < list_document_ids.length; i++){
		document_id = list_document_ids[i];

		await database.get(document_id, {conflicts: true})
			.then(async(document) =>{
				let conflictsArray = document._conflicts;

				if (null != conflictsArray){
					for (k=0; k < conflictsArray.length; k++){
						console.log("     Voy a eliminar de "+ document_id + ", el conflicto: "+ conflictsArray[k]);
						await database.remove(document_id, conflictsArray[k]);
						// Esto es necesario porque puede que al hacer la eliminación la base de datos se haya quedado sin el documento correspondiente
						//await database.put({...document, _rev: document._rev});
					}
				}
			})
	}
}