/* Aquí colocamos todos los reductores que tienen que ver con cambiar algún parámetro del usuario
que actualmente está usando la aplicación en el dispositivo */

import { CHANGE_USER_ID, CHANGE_USERNAME, CHANGE_USER_PROFILE_IMAGE, CHANGE_USER_PRIVILEGES, CHANGE_SYNC_HANDLER } from '../reduxTypes';
import { UNAUTHENTICATED_ID, SERVER_URL } from '../../constants/appConstants'
import PouchDB from 'pouchdb-react-native'

PouchDB.plugin(require('pouchdb-adapter-asyncstorage').default);

const initialState = {
	user_id:        UNAUTHENTICATED_ID,
	userName:       null,
	profileImage:   null,
	privileges:     0,
	localDB:        new PouchDB(UNAUTHENTICATED_ID, {auto_compaction: true, revs_limit: 1}),
	remoteDB:       null,
	syncHandler:    null, // Función que sincroniza la base de datos local con la remota. Esto permite hacer "this.props.syncHandler.cancel()"
};

const userReducer = (state = initialState, action) => {
	switch (action.type){

		// Caso en que cambia el usuario que está activo en la aplicación
		case CHANGE_USER_ID:
			if (action.payload == UNAUTHENTICATED_ID){
				return {
					...state, // Mantenemos igual el resto de la información del estado
					user_id:     UNAUTHENTICATED_ID,
					localDB:     new PouchDB(UNAUTHENTICATED_ID),
					remoteDB:    null,
				}	
			}

			return {
				...state, // Mantenemos igual el resto de la información del estado
				user_id:  action.payload,
				localDB:  new PouchDB(action.payload, {auto_compaction: true, revs_limit: 100}),
				remoteDB: new PouchDB(SERVER_URL + action.payload),
			}

		// Caso en que cambia el nombre de usuario que está activo en la aplicación
		case CHANGE_USERNAME:
			return {
				...state,
				userName: action.payload,
			}

		// Para cambiar la función que sincroniza la base de datos local con la remota
		case CHANGE_SYNC_HANDLER:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				syncHandler: action.payload
			}

		// Para cambiar la imagen de perfil del usuario que está activo en la aplicación
		case CHANGE_USER_PROFILE_IMAGE:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				profileImage: action.payload,
			}

		// Para cambiar los privilegios del usuario que está activo en la aplicación
		case CHANGE_USER_PRIVILEGES:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				privileges: action.payload,
			}

		// Caso por defecto, que se utiliza si el tipo de la acción no coincide con ninguno de los establecidos aquí
		default:
			return state;
	}
}

export default userReducer;