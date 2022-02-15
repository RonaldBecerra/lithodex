/* Aquí colocamos todas las acciones que tienen que ver con cambiar algún parámetro del usuario
que actualmente está usando la aplicación en el dispositivo */

import { CHANGE_USER_ID, CHANGE_USERNAME, CHANGE_USER_PROFILE_IMAGE, CHANGE_USER_PRIVILEGES, CHANGE_SYNC_HANDLER } from '../reduxTypes'

// Cambiamos el identificador del usuario que está activo actualmente en la aplicación
export function changeUser(user_id)
{
	return(
		{
			type:    CHANGE_USER_ID,
			payload: user_id,
		}
	)
}

// Cambiamos el nombre de usuario del que está activo actualmente en la aplicación
export function changeUserName(userName)
{
	return(
		{
			type:    CHANGE_USERNAME,
			payload: userName,
		}
	)
}

// Cambiamos la función que sincroniza la base de datos con la remota
export function changeSyncHandler(syncHandler)
{
	return(
		{
			type:    CHANGE_SYNC_HANDLER,
			payload: syncHandler,
		}
	)
}

// Cambiamos el identificador del usuario que está activo actualmente en la aplicación
export function changeUserProfileImage(profileImage)
{
	return(
		{
			type:    CHANGE_USER_PROFILE_IMAGE,
			payload: profileImage,
		}
	)
}

// Cambiamos los privilegios del usuario que está activo actualmente en la aplicación
export function changeUserPrivileges(newPrivilege)
{
	return(
		{
			type:    CHANGE_USER_PRIVILEGES,
			payload: newPrivilege,
		}
	)
}