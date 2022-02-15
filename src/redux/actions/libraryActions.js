/* Aquí colocamos todas las acciones que tienen que ver con actualizar las listas de litologías,
   estructuras sedimentarias o fósiles, ya que éstas cambian de orden dependiendo del idioma actual */

import { CHANGE_LITHOLOGY_LIST_LANGUAGE, CHANGE_STRUCTURE_LIST_LANGUAGE, CHANGE_FOSSIL_LIST_LANGUAGE,
         CHANGE_NO_CARBONATES_RULE_LANGUAGE, CHANGE_CARBONATES_RULE_LANGUAGE } from '../reduxTypes'
import * as LibraryFunctions from '../../genericFunctions/libraryFunctions'

// Modificamos la lista de litologías que actualmente está siendo usada, debido a un cambio de idioma
export function changeLithologyListLanguage(language)
{
	const sortedLithologies = LibraryFunctions.createSortedListOfLithologies(language);

	return(
		{
			type:    CHANGE_LITHOLOGY_LIST_LANGUAGE,
			payload: sortedLithologies,
		}
	)
}

// Modificamos la lista de estructuras sedimentarias que actualmente está siendo usada, debido a un cambio de idioma
export function changeStructureListLanguage(language)
{
	const sortedStructures = LibraryFunctions.createSortedListOfStructures(language);

	return(
		{
			type:    CHANGE_STRUCTURE_LIST_LANGUAGE,
			payload: sortedStructures,
		}
	)
}

// Modificamos la lista de fósiles que actualmente está siendo usada, debido a un cambio de idioma
export function changeFossilListLanguage(language)
{
	const sortedFossils = LibraryFunctions.createSortedListOfFossils(language);

	return(
		{
			type:    CHANGE_FOSSIL_LIST_LANGUAGE,
			payload: sortedFossils,
		}
	)
}

// Modificamos la regla de los no carbonatos debido a un cambio del idioma
export function changeNoCarbonatesRuleLanguage(language)
{
	const noCarbonatesRule = LibraryFunctions.createNoCarbonatesRule(language);

	return(
		{
			type:    CHANGE_NO_CARBONATES_RULE_LANGUAGE,
			payload: noCarbonatesRule,
		}
	)
}

// Modificamos la regla de los carbonatos debido a un cambio del idioma
export function changeCarbonatesRuleLanguage(language)
{
	const carbonatesRule = LibraryFunctions.createCarbonatesRule(language);

	return(
		{
			type:    CHANGE_CARBONATES_RULE_LANGUAGE,
			payload: carbonatesRule,
		}
	)
}