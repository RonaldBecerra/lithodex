/* Aquí están las acciones que mantendrán control sobre el flujo de las vistas de la aplicación,
   como determinar si una vista debe recargar datos desde la base de datos o no */

import { CHANGE_LOAD_VIEW, CHANGE_GAMMA_RAY_EXTRACT, CHANGE_STRATUM_COMPONENT_PERMISSION, 
	     CHANGE_STACK_SCREENPROPS_FUNCTION, CHANGE_HEADER_TITLE} from '../reduxTypes'


// Para cambiar de estado la variable que determina si una vista debe volver a cargar datos desde la base de datos
export function changeLoadView(bool)
{
	return(
		{
			type:    CHANGE_LOAD_VIEW,
			payload: bool,
		}
	)
}

// Para cambiar el extracto de valores de la gráfica de gamma-ray que se está mostrando en un momento dado
export function changeGammaRay_Extract(gammaRayValues)
{
	return(
		{
			type:    CHANGE_GAMMA_RAY_EXTRACT,
			payload: gammaRayValues,
		}
	)
}

// Para cambiar la variable booleana que permite o impide el acceso a un componente de un estrato (Litología, Estructura sedimentaria, ...)
export function changeStratumComponentPermission(bool)
{
	return(
		{
			type:    CHANGE_STRATUM_COMPONENT_PERMISSION,
			payload: bool,
		}
	)
}

// Para cambiar la función almacenada en el ScreenProps del StackNavigator de la aplicación
export function changeStackScreenPropsFunction(functionRef)
{
	return(
		{
			type:    CHANGE_STACK_SCREENPROPS_FUNCTION,
			payload: functionRef,
		}
	)
}

// Para cambiar el título de la cabecera de las vistas cuando no se puede hacer de la forma convencional
export function changeHeaderTitle(title)
{
	return(
		{
			type:    CHANGE_HEADER_TITLE,
			payload: title,
		}
	)
}