export const ObjectGallery_Texts = {
	spanish: [
		"núcleo", // 0
		"afloramiento", // 1
		"Galería de núcleos", // 2
		"Galería de afloramientos", // 3
		"Fecha de registro: ", // 4
		"Localización: ", // 5
		"Altura base: ", // 6
		"Altura terminal: ", // 7
		"DF:    ", // 8
		"GL:    ", // 9
		"Alerta", // 10
		function(object){return "No se puede abrir el mapa porque las coordenadas de este " + object + " no son válidas"}, // 11
		"No se puede abrir este enlace", // 12
		function(object){return "El " + object + " fue salvado"}, // 13
		"No tiene los permisos requeridos", // 14
		"El archivo fue cargado exitosamente", // 15
		"El archivo fue cargado, pero no se pudieron encontrar todas las imágenes", // 16
		function(object){return "El archivo no se corresponde con un " + object}, // 17
		"Ocurrió un error al tratar de leer el archivo", // 18
		function(object){return "¿Seguro de que desea eliminar el " + object + "?"}, // 19
		"Sí", // 20
		"No", // 21
		function(object){return "Editar información de " + object}, // 22
		"Ver localización en Google Maps", // 23
		"Ver localización en Google Earth", // 24
		"Salvar en archivo", // 25
		function(object){return "Eliminar " + object}, // 26
		"Volver", // 27
		"Crear nuevo", // 28
		"Agregar desde archivo", // 29
		"Cargando", // 30
		function(object){return "Agregar " + object}, // 31
		"Ocurrió un error al tratar de guardar este archivo", // 32
	],

	english: [
		"core", // 0
		"outcrop", // 1
		"Core gallery", // 2
		"Outcrop gallery", // 3
		"Registration date: ", // 4
		"Location: ", // 5
		"Base height: ", // 6
		"End height: ", // 7
		"DF:    ", // 8
		"GL:    ", // 9
		"Alert", // 10
		function(object){return "The map cannot be opened because the coordinates of this " + object + " are not valid"}, // 11
		"Can't open this link", // 12
		function(object){return "The " + object + " was saved"}, // 13
		"You do not have the required permissions", // 14
		"The file was successfully loaded", // 15
		"The file was loaded, but not all the images could be found", // 16
		function(object){return "The file does not correspond to " + ((object=='core') ? "a" : "an") + object}, // 17
		"An error occurred when trying to read the file", // 18
		function(object){return "Are you sure you want to remove the " + object + "?"}, // 19
		"Yes", // 20
		"No", // 21
		function(object){return "Edit " + object + " information"}, // 22
		"Show location in Google Maps", // 23
		"Show location in Google Earth", // 24
		"Save on file", // 25
		function(object){return "Delete " + object}, // 26
		"Return", // 27
		"Create new", // 28
		"Add from file", // 29
		"Loading", // 30
		function(object){return "Add " + object}, // 31
		"An error occurred while trying to save this file", // 32
	],
}
