/* Aquí están los reductores que le permiten al usuario cambiar aspectos de la aplicación que tienen que ver
con las preferencias, como el lenguaje, el color de letra de las cabeceras, etc. */

import { CHANGE_LANGUAGE, CHANGE_HEADER_BACKGROUND_COLOR, CHANGE_HEADER_TINT_COLOR } from '../reduxTypes';

const initialState = {
	language:              'spanish',
	headerBackgroundColor: "#0080FF",
	headerTintColor:       'white',
};

const appPreferencesReducer = (state = initialState, action) => {
	switch (action.type){

		// Para cambiar el idioma de la aplicación
		case CHANGE_LANGUAGE:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				language: action.payload,
			}

		// Para cambiar el color de fondo de la cabecera de las vistas ---> Inutilizada por el momento
		case CHANGE_HEADER_BACKGROUND_COLOR:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				headerBackgroundColor: action.payload,
			}

		// Para cambiar el color de fondo de la cabecera de las vistas ---> Inutilizada por el momento
		case CHANGE_HEADER_TINT_COLOR:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				headerTintColor: action.payload,
			}

		// Caso por defecto, que se utiliza si el tipo de la acción no coincide con ninguno de los establecidos aquí
		default:
			return state;
	}
}

export default appPreferencesReducer;