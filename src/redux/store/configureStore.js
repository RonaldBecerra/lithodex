/*
 * Cuando el archivo App.js invoque a la función "configureStore", automáticamente se
 * creará una tienda cuyo reductor es "rootReducer". En dicha tienda estarán todos
 * los datos que sean necesarios mantener como globales para no tener que heredarlos
 * de una vista a otra.
 *
 * La función "combineReducers" combina todos los diferentes reductores en uno solo
 * y forma el estado global.
 */
 
import { createStore, combineReducers } from 'redux'

// Importamos todos los reductores creados
import appPreferencesReducer from '../reducers/appPreferencesReducer'
import userReducer           from '../reducers/userReducer'
import libraryReducer        from '../reducers/libraryReducer'
import popUpReducer          from '../reducers/popUpReducer'


const rootReducer = combineReducers({
	appPreferencesReducer: appPreferencesReducer,
	userReducer:           userReducer,
	libraryReducer:        libraryReducer,
	popUpReducer:          popUpReducer,
})

const configureStore = () => createStore(rootReducer);

export default configureStore;