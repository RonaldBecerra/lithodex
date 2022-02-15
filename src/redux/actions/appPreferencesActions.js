/* Aquí están las acciones que le permiten al usuario cambiar aspectos de la aplicación que tienen que ver
con las preferencias, como el lenguaje, el color de letra de las cabeceras, etc. */

import { CHANGE_LANGUAGE, CHANGE_HEADER_BACKGROUND_COLOR, CHANGE_HEADER_TINT_COLOR } from '../reduxTypes'


// Para cambiar el idioma de la aplicación 
export function changeLanguage(language)
{
	return(
		{
			type:    CHANGE_LANGUAGE,
			payload: language,
		}
	)
}

// Para cambiar el color de fondo de la cabecera de las vistas ---> Inutilizada por el momento
export function changeHeaderBackgroundColor(color)
{
	return(
		{
			type:    CHANGE_HEADER_BACKGROUND_COLOR,
			payload: color,
		}
	)
}

// Para cambiar el color de las letras de la cabecera de las vistas ---> Inutilizada por el momento
export function changeHeaderTintColor(color)
{
	return(
		{
			type:    CHANGE_HEADER_TINT_COLOR,
			payload: color,
		}
	)
}