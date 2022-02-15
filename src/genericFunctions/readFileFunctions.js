import * as Regex from '../constants/regularExpressions'
import * as auxiliarFunctions from './otherFunctions'

/* Esta función sirve está diseñada para leer archivos con información de núcleos que tengan el mismo formato que los enviados por el profesor José Baena, 
   aunque también contempla algunas ligeras variaciones, como si por ejemplo faltan algunos datos.

   Ésta función asume que los valores de profundidad van apareciendo de forma decreciente; si llegaran a estar desordenados, ocurrirían inconsistencias
 */
export function readCoreFile(file){
	// En los siguientes arreglos, el primer elemento será el valor, y el segundo será la unidad (0 para metros, y 1 para pies). 
	var DF         = []; // Drill Floor
	var GL         = []; // Ground Level
	var BaseHeight = []; // Altura base (la más alta desde la que se comienza a registrar el núcleo)
	var EndHeight  = []; // Altura terminal (la más baja a la que se registra el núcleo)
	var Scale      = []; // Escala a la que se mostrará el núcleo

	// Es necesario separar tanto la lista de valores del eje x, como la lista de valores del eje y, así como también la lista de pares ordenados,
	// porque de esa forma los leerá la librería usada.
	var gammaRayValues = {
		xValuesMeters: [], // Conjunto de valores del eje x (profundidades) expresados en metros
		xValuesFeet:   [], // Conjunto de valores del eje x (profundidades) expresados en pies
		yValues:       [], // Conjunto de valores del eje y (rayos-gamma) 

		numberMeasurements: 0,    // Longitud de cada uno de los tres arreglos anteriores 
		maxYValue:          null, // Mayor valor de gamma-ray que se leyó
		minYValue:          null, // Menor valor de gamma-ray que se leyó
		minDifference:      null, // Mínima diferencia de espacio entre una lectura y otra
	};  

	var nullValue = "?"; // Valor que se tomará como nulo al leer la tabla
	var step      = null; // Paso (diferencia de altura constante entre una línea de medición y otra)
	var lines = file.split("\n"); // Arreglo cuyos elementos son las líneas del archivo leído
	var linesWithoutSpaces = []   /* Arreglo cuyos elementos serán a su vez arreglos. Cada uno de los subarreglos corresponderá a una línea del archivo leído,
	                                 pero eliminando los espacios entre las palabras, y esa eliminación da lugar a varios elementos (cada palabra). */

	for (var i = 0; i < lines.length; i++){
		var newLine = lines[i].split(Regex.REGULAR_EXPRESSION_5); // El REGULAR_EXPRESSION_5 es para que la expresión regular del "split" reconozca varios espacios seguidos
		linesWithoutSpaces.push(newLine);
	}

	// Las siguientes variables determinan si todavía hay que buscar el valor correspondiente
	var lookForDF          = true; // Drill Floor
	var lookForGL          = true; // Ground Level
	var lookForBaseHeight  = true; // Altura base
	var lookForEndHeight   = true; // Altura terminal (la más profunda)
	var lookForStep        = true; // Paso (diferencia de altura constante entre una línea de medición de profundidad y otra)
	var lookForNullValue   = true; // Valor que indica nulo en la tabla de valores

	var condition          = true; // Determina si todavía hay que buscar alguno de los elementos cuyo nombre incluye también la unidad de medición, separada por un punto
	var headerIndex        = null; // Posición desde la que tiene que leerse la tabla de valores

	var feetAreApplied     = false; // Determina si alguna vez en el documento son utilizados los pies como unidades
	var metersAreApplied   = false; // Determina si alguna vez en el documento son utilizados los metros como unidades
	
	for (var i = 0; i < linesWithoutSpaces.length; i++){
		var currentLine  = linesWithoutSpaces[i];
		var firstElement = currentLine[0];

		if (condition){
			var separatedfirstElement = firstElement.split("."); // Esto para que separe por exactamente un punto

			switch(separatedfirstElement[0]){

				// Caso en que buscamos el Drill Floor
				case "EDF":
					var value = parseFloat(currentLine[1]); // El 'parseFloat' elimina caracteres adicionales al número, como si por ejemplo tenemos "3175:", lo deja en 3175.
					DF.push(value.toString());          // Lo que guardamos es el valor pero en cadena de caracteres, porque así es como será leído después.
					lookForDF = false;
					condition = (lookForGL || lookForBaseHeight || lookForEndHeight || lookForNullValue || lookForStep );
					if (separatedfirstElement[1] === "FT"){
						DF.push(1);
						feetAreApplied = true;
					}
					else {
						DF.push(0);
						metersAreApplied = true;
					}
					break;
				
				// Caso en que buscamos el Ground Level
				case "EGL": 
					var value = parseFloat(currentLine[1]); // El 'parseFloat' elimina caracteres adicionales al número, como si por ejemplo tenemos "3175:", lo deja en 3175.
					GL.push(value.toString());          // Lo que guardamos es el valor pero en cadena de caracteres, porque así es como será leído después.
					lookForGL = false;
					condition = (lookForDF || lookForBaseHeight || lookForEndHeight || lookForNullValue || lookForStep);
					if (separatedfirstElement[1] === "FT"){
						GL.push(1);
						feetAreApplied = true;
					}
					else {
						GL.push(0);
						metersAreApplied = true;
					}
					break;

				// Caso en que buscamos la altura base
				case "STRT":
					var value = parseFloat(currentLine[1]); // El 'parseFloat' elimina caracteres adicionales al número, como si por ejemplo tenemos "3175:", lo deja en 3175.

					if (currentLine.length > 2){
						if (currentLine[3] === "DEPTH"){
							value *= -1;
						}
					}
					BaseHeight.push(value.toString());  // Lo que guardamos es el valor pero en cadena de caracteres, porque así es como será leído después.
					lookForBaseHeight = false;
					condition = (lookForDF || lookForGL || lookForEndHeight || lookForNullValue || lookForStep);
					if (separatedfirstElement[1] === "FT"){
						BaseHeight.push(1);
						feetAreApplied = true;
					}
					else {
						BaseHeight.push(0);
						metersAreApplied = true;
					}
					break;

				// Caso en que buscamos la altura terminal
				case "STOP":
					var value = parseFloat(currentLine[1]); // El 'parseFloat' elimina caracteres adicionales al número, como si por ejemplo tenemos "3175:", lo deja en 3175.
					if (currentLine.length > 2){
						if (currentLine[3] === "DEPTH"){
							value *= -1;
						}
					}
					EndHeight.push(value.toString());   // Lo que guardamos es el valor pero en cadena de caracteres, porque así es como será leído después.
					lookForEndHeight = false;
					condition = (lookForDF || lookForGL || lookForBaseHeight || lookForNullValue || lookForStep);
					if (separatedfirstElement[1] === "FT"){
						EndHeight.push(1);
						feetAreApplied = true;
					}
					else {
						EndHeight.push(0);
						metersAreApplied = true;
					}
					break;

				// Caso en que buscamos el valor que se considera como nulo en la tabla
				case "NULL":
					nullValue = parseFloat(currentLine[1]); // El 'parseFloat' elimina caracteres adicionales al número, como si por ejemplo tenemos "3175:", lo deja en 3175.
					lookForNullValue = false;
					condition = (lookForDF || lookForGL || lookForBaseHeight || lookForEndHeight || lookForStep);
					break;		

				// Caso en que buscamos el valor que es el paso de la tabla
				case "STEP":
					var value   = parseFloat(currentLine[1]); // El 'parseFloat' elimina caracteres adicionales al número, como si por ejemplo tenemos "3175:", lo deja en 3175.
					lookForStep = false;
					condition   = (lookForDF || lookForGL || lookForBaseHeight || lookForEndHeight || lookForNullValue);
					if (separatedfirstElement[1] === "FT"){
						gammaRayValues.minDifference = [auxiliarFunctions.feetToMeters(value)[0], value];
						Scale = [auxiliarFunctions.repairNumber(value,20), 1];
					}
					else {
						gammaRayValues.minDifference = [value, auxiliarFunctions.metersToFeet(value)[0]];
						Scale = [auxiliarFunctions.repairNumber(value,20), 0];
					}
					break;	

				default: 
					break;
			}
		}
		// Aquí paramos la ejecución de este ciclo porque se encontró la cabecera de la tabla
		if (firstElement === "~A") {
			headerIndex = i;
			break;
		}
	}

	// Caso en que encontramos una cabecera iniciada por "~A"
	if (headerIndex != null) {
		var currentLine         = linesWithoutSpaces[headerIndex]; // Número de línea que tiene la cabecera de la tabla de valores
		var gammaRayPosition    = currentLine.findIndex(element => element === "GR"); // Como la tabla tiene varias columnas, hay que ver qué número de columna es la del gamma-ray
		
		// Primero determinamos cuál es la unidad de medición
		if ((feetAreApplied && !metersAreApplied) || (feetAreApplied && metersAreApplied) || (!feetAreApplied && !metersAreApplied)) {
			// >>>>>>>>>>>>>>> OJO CON ESTE CASO:Si se aplicaron las dos unidades de medición o si no se aplicó ninguna, entonces no hay manera de saber cuál es la
			// estándar de este documento, por lo que tomamos la decisión (arbitraria) de considerar que se están utilizando pies en la tabla de "gamma-ray"
			var unit = 1;
		}
		else { // Sólo consideramos que las unidades son metros cuando no se leyó ningún "FT", y sí se leyó algún dato numérico
			var unit = 0;
		}

		// Número de columna de la tabla donde se indican las profundidades
		var depthPosition = currentLine.findIndex(element => element === "Depth");

		// Esto es sólo para inicializar estas variables
		var newDepthValueMeters = null; // Valor de profundidad en metros
		var newDepthValueFeet   = null; // Valor de profundidad en pies
		var newGRValue          = null; // Valor de gamma-ray
		
		// Separamos por casos dependiendo de si ya fue leído un paso o no, porque si fue leído entonces no debemos preocuparnos por
		// encontrar una diferencia mínima al leer la tabla
		if (gammaRayValues.minDifference != null) {   // Aquí ya hemos encontrado un paso
			
			// También separamos por casos dependiendo de si lo que estamos leyendo son valores en metros o en pies.
			// No ponemos este condicional dentro del for para que no haya que evaluarlo en cada iteración

			if (unit == 0){ // Caso en que los valores de profundidad representan metros
				for (i = headerIndex + 1; i < linesWithoutSpaces.length; i++){ 
					currentLine         = linesWithoutSpaces[i];
					newDepthValueMeters = parseFloat(currentLine[depthPosition]) * (-1);
					newDepthValueFeet   = auxiliarFunctions.metersToFeet(newDepthValueMeters)[0];
					newGRValue          = parseFloat(currentLine[gammaRayPosition]);

					if (!Number.isNaN(newGRValue)){ // Por si acaso se lee una línea vacía

						gammaRayValues.xValuesMeters.push(newDepthValueMeters);
						gammaRayValues.xValuesFeet.push(newDepthValueFeet);

						if (newGRValue != nullValue){
							gammaRayValues.yValues.push(newGRValue);
						}
						else {
							gammaRayValues.yValues.push(null);
						}
					}
				}
			}
			else { // Caso en que los valores de profundidad representan pies
				for (i = headerIndex + 1; i < linesWithoutSpaces.length; i++){
					currentLine         = linesWithoutSpaces[i];
					newDepthValueFeet   = parseFloat(currentLine[depthPosition]) * (-1);
					newDepthValueMeters = auxiliarFunctions.feetToMeters(newDepthValueFeet)[0];
					newGRValue          = parseFloat(currentLine[gammaRayPosition]);

					if (!Number.isNaN(newGRValue)){ // Por si acaso se lee una línea vacía

						gammaRayValues.xValuesMeters.push(newDepthValueMeters);
						gammaRayValues.xValuesFeet.push(newDepthValueFeet);

						if (newGRValue != nullValue){
							gammaRayValues.yValues.push(newGRValue);
						}
						else {
							gammaRayValues.yValues.push(null);
						}
					}
				}
			}
		} else { // Caso en que el documento no suministró un paso, por lo que tenemos que encontrar la mínima diferencia

			var minDifference = 10000000; // Esta variable almacenará la mínima diferencia leída

			// Caso en que los valores de profundidad representan metros
			if (unit == 0){ 

				// Esta primera iteración la sacamos del ciclo para que no haya que comprobar en todo momento si la lectura anterior, que se va 
				// a utilizar para obtener la diferencia entre la actual y la anterior, era nula, lo cual ocurre en la primera iteración únicamente.
				currentLine         = linesWithoutSpaces[headerIndex + 1];
				newDepthValueMeters = parseFloat(currentLine[depthPosition]) * (-1);
				newDepthValueFeet   = auxiliarFunctions.metersToFeet(newDepthValueMeters)[0];
				newGRValue          = parseFloat(currentLine[gammaRayPosition]);

				if (!Number.isNaN(newGRValue)){ // Por si acaso se lee una línea vacía

					gammaRayValues.xValuesMeters.push(newDepthValueMeters);
					gammaRayValues.xValuesFeet.push(newDepthValueFeet);

					if (newGRValue != nullValue){
						gammaRayValues.yValues.push(newGRValue);
					}
					else {
						gammaRayValues.yValues.push(null);
					}
				}

				var previousLecture = newDepthValueMeters; 

				for (i = headerIndex + 2; i < linesWithoutSpaces.length; i++){ 
					currentLine         = linesWithoutSpaces[i];
					newDepthValueMeters = parseFloat(currentLine[depthPosition]) * (-1);
					newDepthValueFeet   = auxiliarFunctions.metersToFeet(newDepthValueMeters)[0];
					newGRValue          = parseFloat(currentLine[gammaRayPosition]);

					if (!Number.isNaN(newGRValue)){ // Por si acaso se lee una línea vacía

						gammaRayValues.xValuesMeters.push(newDepthValueMeters);
						gammaRayValues.xValuesFeet.push(newDepthValueFeet);

						if (newGRValue != nullValue){
							gammaRayValues.yValues.push(newGRValue);
						}
						else {
							gammaRayValues.yValues.push(null);
						}
						minDifference   = Math.min(minDifference, previousLecture - newDepthValueMeters);
						previousLecture = newDepthValueMeters;
					}
				}
				gammaRayValues.minDifference = [minDifference, auxiliarFunctions.metersToFeet(minDifference)[0]];
			}
			else { // Caso en que los valores de profundidad representan pies

				// Esta primera iteración la sacamos del ciclo para que no haya que comprobar en todo momento si la lectura anterior, que se va 
				// a utilizar para obtener la diferencia entre la actual y la anterior, era nula, lo cula ocurre en la primera iteración únicamente.
				currentLine         = linesWithoutSpaces[headerIndex + 1];
				newDepthValueFeet   = parseFloat(currentLine[depthPosition]) * (-1);
				newDepthValueMeters = auxiliarFunctions.feetToMeters(newDepthValueFeet)[0];
				newGRValue          = parseFloat(currentLine[gammaRayPosition]);

				if (!Number.isNaN(newGRValue)){ // Por si acaso se lee una línea vacía

					gammaRayValues.xValuesMeters.push(newDepthValueMeters);
					gammaRayValues.xValuesFeet.push(newDepthValueFeet);

					if (newGRValue != nullValue){
						gammaRayValues.yValues.push(newGRValue);
					}
					else {
						gammaRayValues.yValues.push(null);
					}
				}

				var previousLecture = newDepthValueFeet; 

				for (i = headerIndex + 2; i < linesWithoutSpaces.length; i++){
					currentLine         = linesWithoutSpaces[i];
					newDepthValueFeet   = parseFloat(currentLine[depthPosition]) * (-1);
					newDepthValueMeters = auxiliarFunctions.feetToMeters(newDepthValueFeet)[0];
					newGRValue          = parseFloat(currentLine[gammaRayPosition]);

					if (!Number.isNaN(newGRValue)){ // Por si acaso se lee una línea vacía

						gammaRayValues.xValuesMeters.push(newDepthValueMeters);
						gammaRayValues.xValuesFeet.push(newDepthValueFeet);

						if (newGRValue != nullValue){
							gammaRayValues.yValues.push(newGRValue);
						}
						else {
							gammaRayValues.yValues.push(null);
						}
						minDifference   = Math.min(minDifference, previousLecture - newDepthValueFeet);
						previousLecture = newDepthValueFeet;
					}
				}
				gammaRayValues.minDifference = [auxiliarFunctions.feetToMeters(minDifference)[0], minDifference];
			}
		}
		gammaRayValues.numberMeasurements = gammaRayValues.yValues.length;
		gammaRayValues.minYValue = Math.min.apply(Math, gammaRayValues.yValues);
		gammaRayValues.maxYValue = Math.max.apply(Math, gammaRayValues.yValues);
	}
	return {DF, GL, BaseHeight, EndHeight, Scale, gammaRayValues};
}