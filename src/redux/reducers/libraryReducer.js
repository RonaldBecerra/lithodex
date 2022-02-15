/* Aquí colocamos todos los reductores que tienen que ver con actualizar las listas de litologías,
   estructuras sedimentarias o fósiles, ya que éstas cambian de orden dependiendo del idioma actual */

import { CHANGE_LITHOLOGY_LIST_LANGUAGE, CHANGE_STRUCTURE_LIST_LANGUAGE, CHANGE_FOSSIL_LIST_LANGUAGE,
         CHANGE_NO_CARBONATES_RULE_LANGUAGE, CHANGE_CARBONATES_RULE_LANGUAGE } from '../reduxTypes'
import * as LibraryFunctions from '../../genericFunctions/libraryFunctions'

const initialState = {
	sortedLithologies: LibraryFunctions.createSortedListOfLithologies('spanish'),
	sortedStructures:  LibraryFunctions.createSortedListOfStructures('spanish'),
	sortedFossils:     LibraryFunctions.createSortedListOfFossils('spanish'),
	noCarbonatesRule:  LibraryFunctions.createNoCarbonatesRule('spanish'),
	carbonatesRule:    LibraryFunctions.createCarbonatesRule('spanish'),
};

const libraryReducer = (state = initialState, action) => {
	switch (action.type){

		// Caso en que debe cambiarse la lista de litologías debido a un cambio del idioma
		case CHANGE_LITHOLOGY_LIST_LANGUAGE:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				sortedLithologies: action.payload,
			}

		// Caso en que debe cambiarse la lista de estructuras debido a un cambio del idioma
		case CHANGE_STRUCTURE_LIST_LANGUAGE:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				sortedStructures: action.payload,
			}

		// Caso en que debe cambiarse la lista de fósiles debido a un cambio del idioma
		case CHANGE_FOSSIL_LIST_LANGUAGE:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				sortedFossils: action.payload,
			}

		// Caso en que debe cambiarse la regla de los no carbonatos debido a un cambio del idioma
		case CHANGE_NO_CARBONATES_RULE_LANGUAGE:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				noCarbonatesRule: action.payload,
			}

		// Caso en que debe cambiarse la regla de los carbonatos debido a un cambio del idioma
		case CHANGE_CARBONATES_RULE_LANGUAGE :
			return {
				...state, // Mantenemos igual el resto de la información del estado
				carbonatesRule: action.payload,
			}

		// Caso por defecto, que se utiliza si el tipo de la acción no coincide con ninguno de los establecidos aquí
		default:
			return state;
	}
}

export default libraryReducer;