import * as auxiliarFunctions from './otherFunctions'
import _ from "lodash"

// Sirve para subir  estrato de lugar una posición
export function riseLayer(li,layer,i){
	const previous = li[i-1]; // El estrato que estaba en la posición en la que ahora estará el actual

	previous.lowerLimit    = _.cloneDeep(layer.lowerLimit);
	previous.upperLimit[0] = auxiliarFunctions.repairNumber(previous.lowerLimit[0][0] + previous.thickness[0][0], 15);
	previous.upperLimit[1] = auxiliarFunctions.repairNumber(previous.lowerLimit[1][0] + previous.thickness[1][0], 15);
	li[i] = previous;

	layer.lowerLimit    = _.cloneDeep(previous.upperLimit);
	layer.upperLimit[0] = auxiliarFunctions.repairNumber(layer.lowerLimit[0][0] + layer.thickness[0][0], 15);
	layer.upperLimit[1] = auxiliarFunctions.repairNumber(layer.lowerLimit[1][0] + layer.thickness[1][0], 15);
	li[i-1]             = layer;

	return li;
}

// Sirve para bajar al estrato de lugar una posición
export function lowerLayer(li,layer,i){
	const previous = li[i+1]; // El estrato que estaba en la posición en la que ahora estará el actual

	layer.lowerLimit    = _.cloneDeep(previous.lowerLimit);
	layer.upperLimit[0] = auxiliarFunctions.repairNumber(layer.lowerLimit[0][0] + layer.thickness[0][0], 15);
	layer.upperLimit[1] = auxiliarFunctions.repairNumber(layer.lowerLimit[1][0] + layer.thickness[1][0], 15);
	li[i+1]             = layer;

	previous.lowerLimit    = _.cloneDeep(layer.upperLimit);
	previous.upperLimit[0] = auxiliarFunctions.repairNumber(previous.lowerLimit[0][0] + previous.thickness[0][0], 15);
	previous.upperLimit[1] = auxiliarFunctions.repairNumber(previous.lowerLimit[1][0] + previous.thickness[1][0], 15);		
	li[i]                  = previous;

	return li;
}

/* Para buscar de modo binario el índice de un estrato particular de una lista de estratos, 
   tal que un valor que recibe la función está comprendido entre los límites del estrato
 */
function binarySearchForLayerList(inferiorBound, superiorBound, layerList, unit, value){
	var index     = null; // Índice que retorna esta función
	var sumBounds = null; // Suma de la cota superior con la inferior
	var elem      = null; // Elemento de la lista de estratos que se está examinando en un momento dado

	while (superiorBound >= inferiorBound){
		sumBounds = inferiorBound + superiorBound;
		index     = (sumBounds%2 == 0) ? (sumBounds/2) : Math.floor(sumBounds/2);
		elem      = layerList[index];

		if (value <= elem.upperLimit[unit][0]){
			if (elem.lowerLimit[unit][0] <= value){
				return index; // Caso en que encontramos el elemento, porque las dos condiciones fueron satisfechas
			} else{
				superiorBound = index - 1;
			}
		} else {
			inferiorBound = index + 1;
		}
	}
	// En principio nunca deberíamos caer en este caso, porque la búsqueda binaria sólo debería hacerse cuando el valor está comprendido
	// entre los límites. Pero lo dejamos para que dé errores si esa condición no se cumplre
	return null; 
}

/* Para construir el arreglo de estratos provisional para hacer una captura de vista. Tómese en cuenta que no modifica
   en los estratos los valores correspondientes a la unidad que no se va a mostrar en la captura. Por ejemplo, si 
   estamos trabajando en metros no se modifican los límites expresados en pies.
 */
export function createLayerListForShot(minHeight, maxHeight, layerList, unit, factorThickness){
	if (layerList.length == 0){
		return [];
	}

	// Recuerda que los estratos están ordenados de forma decreciente. Revertimos el arreglo por comodidad
	var array        = layerList.reverse(); 
	var len_MinusOne = layerList.length - 1;
	var indexMax     = len_MinusOne; // Índice del estrato superior que saldrá en la captura
	var indexMin     = 0;            // Índice del estrato inferior que saldrá en la captura

	// Caso en que devolvemos un arreglo vacío porque los límites indican que ningún estrato está incluido entre ellos
	// Como está actualmente la aplicación, en los afloramientos esto no debería ocurrir nunca, pero sí podría pasar en los núcleos,
	// porque puede que capturemos una parte que sólo tiene registrado valores gamma-ray
	if ((maxHeight < array[0].lowerLimit[unit][0]) || (minHeight > array[len_MinusOne].upperLimit[unit][0])){
		return [];
	}

	// Actualizamos el índice superior sólo si es necesario
	if (maxHeight < array[len_MinusOne].upperLimit[unit][0]){
		indexMax = binarySearchForLayerList(0, len_MinusOne, array, unit, maxHeight);
		array    = array.slice(0,indexMax+1);
	}

	// Actualizamos el índice inferior sólo si es necesario
	if (minHeight > array[0].lowerLimit[unit][0]){
		indexMin = binarySearchForLayerList(0, indexMax, array, unit, minHeight);
		array    = array.slice(indexMin);
	}

	// Modificamos el estrato inferior de la captura
	let firstElem     = array[0];
	let newLowerLimit = Math.max(minHeight, firstElem.lowerLimit[unit][0]);

	firstElem.thickness[unit]   = auxiliarFunctions.repairNumber(firstElem.upperLimit[unit][0] - newLowerLimit, 20);
	firstElem.shownHeight[unit] = firstElem.thickness[unit][0] * factorThickness;
	firstElem.lowerLimit[unit]  = auxiliarFunctions.repairNumber(newLowerLimit,20);
	array[0] = firstElem;

	// Modificamos el estrato superior de la captura
	let lenArray_MinusOne = array.length -1;

	let lastElem      = array[lenArray_MinusOne];
	let newUpperLimit = Math.min(maxHeight,lastElem.upperLimit[unit][0]);

	lastElem.thickness[unit]   = auxiliarFunctions.repairNumber(newUpperLimit - lastElem.lowerLimit[unit][0], 20);
	lastElem.shownHeight[unit] = lastElem.thickness[unit][0] * factorThickness;
	lastElem.upperLimit[unit]  = auxiliarFunctions.repairNumber(newUpperLimit, 20);
	array[lenArray_MinusOne]   = lastElem;

	return array.reverse();
}

/* Esto sirve para que sólo se muestre una parte del total de arreglo de estratos. Devuelve el índice del estrato inferior
   que se mostrará, y el del superior, según las alturas mínima y máxima indicadas. Si el estrato inferior comienza por debajo
   de la altura mínima, o el superior termina por encima de la altura máxima, ninguno de ellos se cortará, sino que permanecerán
   completos.
 */
export function getStratumsIndexes(minHeight, maxHeight, layerList, unit, factorThickness){
	if (layerList.length == 0){
		return [null,null];
	}

	// Recuerda que los estratos están ordenados de forma decreciente. Revertimos el arreglo por comodidad
	var array        = layerList.reverse(); 
	var len_MinusOne = layerList.length - 1;
	var indexMax     = len_MinusOne; // Índice del estrato superior del arreglo
	var indexMin     = 0;            // Índice del estrato inferior del arreglo

	// Caso en que devolvemos índices nulos porque los límites indican que ningún estrato está incluido entre ellos
	// Como está actualmente la aplicación, en los afloramientos esto no debería ocurrir nunca, pero sí podría pasar en los núcleos,
	// porque puede que capturemos una parte que sólo tiene registrado valores gamma-ray
	if ((maxHeight < array[0].lowerLimit[unit][0]) || (minHeight > array[len_MinusOne].upperLimit[unit][0])){
		return [null, null];
	}

	// Actualizamos el índice superior sólo si es necesario
	if (maxHeight < array[len_MinusOne].upperLimit[unit][0]){
		indexMax = binarySearchForLayerList(0, len_MinusOne, array, unit, maxHeight);
	}

	// Actualizamos el índice inferior sólo si es necesario
	if (minHeight > array[0].lowerLimit[unit][0]){
		indexMin = binarySearchForLayerList(0, indexMax, array, unit, minHeight);
	}

	// El primer elemento es el índice inferior del arreglo, y el segundo es el superior
	// Recuérdese que el arreglo original está invertido
	return [len_MinusOne-indexMin, len_MinusOne-indexMax];
}

/* Función para buscar de modo binario un índice en un arreglo de valores de eje x de gamma-ray, es decir, valores de profundidad.
   Puede ser el índice del máximo elemento menor o igual, o bien del mínimo elemento mayor o igual al valor "value" dado.
   Cuál de los dos tipos de búsqueda haremos depende del parámetro "kindOfSearch". Si éste es 0, buscamos un elemento menor o igual,
   y si es 1, buscamos un elemento mayor o igual.
 */
function binarySearchForGammaRayXValues(inferiorBound, superiorBound, array, value, kindOfSearch){
	const len = array.length; // Cantidad de elementos en el arreglo

	var index     = null; // Índice que retorna esta función
	var sumBounds = null; // Suma de la cota superior con la inferior
	var elem      = null; // Elemento que se está examinando actualmente

	while (superiorBound >= inferiorBound){
		sumBounds = inferiorBound + superiorBound;
		index     = (sumBounds%2 == 0) ? (sumBounds/2) : Math.floor(sumBounds/2);
		elem      = array[index];

		if (value == elem){
			break; // El elemento coincide con el valor que estábamos buscando
		}
		else if (value < elem){
			const indexPrev = index - 1;

			// Si estamos haciendo una búsqueda de menor o igual, hay que revisar el elemento anterior						
			if ((kindOfSearch == 0) && (array[indexPrev] <= value)){
				return indexPrev;
			} 
			superiorBound = indexPrev;
		}
		else { // Caso en que elem < value
			const indexNext = index + 1;

			// Si estamos haciendo una búsqueda de mayor o igual, debemos revisar el elemento siguiente
			if ((kindOfSearch == 1) && (value <= array[indexNext])){
				return indexNext;
			}
			inferiorBound = indexNext;
		}
	}
	return index;
}

// Para construir el objeto con los valores de gamma-ray para hacer una captura de la vista, o bien paara tomar sólo un extracto
export function createGammaRayValuesProvisional(minHeight, maxHeight, gammaRayValues, unit){
	// Es necesario copiar el arreglo correspondiente, no referenciarlo, porque entonces no estaremos refiriendo
	// al mismo objeto
	var array = (unit == 0) ? _.cloneDeep(gammaRayValues.xValuesMeters) : _.cloneDeep(gammaRayValues.xValuesFeet);
	
	// Los valores están ordenados de forma decreciente, así que invertimos el arreglo por comodidad
	array.reverse(); 

	const len_MinusOne  = array.length - 1;  // Cantidad de elementos en el arreglo, menos una unidad
	var   lastIndex     = len_MinusOne;      // Último índice que se tomará del arreglo
	var   firstIndex    = 0;                 // Primer índice que se tomará del arreglo
	var   minDifference = _.cloneDeep(gammaRayValues.minDifference); // Mínima diferencia entre una medición y otra

	// Objeto con los campos vacíos
	const empty = {
		xValuesMeters: [],
		xValuesFeet:   [],
		yValues:       [],

		numberMeasurements: 0,
		maxYValue:          null,
		minYValue:          null,
		minDifference:      [null,null],
	}

	/* Casos en que no hay elementos que mostrar: 
	   	1) No hay elementos en el arreglo,
	   	2) altura máxima menor que el mínimo elemento del arreglo,
	    3) o altura mínima mayor que el máximo elemento del arreglo, 
	 */
	if ((len_MinusOne < 0) || (maxHeight < array[0]) || (array[len_MinusOne] < minHeight) ){
		return empty;
	}

	// Reducimos el arreglo según la altura máxima a mostrar, pero sólo si la altura máxima no es mayor que todos
	// los elementos del arreglo, porque en ese caso habrá que devolverlos todos
	if (maxHeight <= array[len_MinusOne]) {
		lastIndex = binarySearchForGammaRayXValues(0, lastIndex, array, maxHeight, 0);
		array     = array.slice(0,lastIndex+1);

		// El haber reducido el arreglo puede haber hecho que la altura mínima sea mayor que el máximo del sobrante del arreglo
		if (array[lastIndex] < minHeight){
			return empty;
		}
	}

	// Reducimos el arreglo según la altura mínima a mostrar, pero sólo si la altura mínima no es menor que todos
	// los elementos del arreglo, porque en ese caso habrá que devolverlos todos
	if (array[0] <= minHeight) {
		firstIndex = binarySearchForGammaRayXValues(0, lastIndex, array, minHeight, 1);
		array      = array.slice(firstIndex);
	}

	// Actualizamos la mínima diferencia entre una medición y otra.
	const lenNewArray = array.length; // Cantidad de elementos en el arreglo sobrante
	if (lenNewArray > 1){
		var difference = null;
		for (i = 1; i < lenNewArray; i++){
			difference = array[i] - array[i-1];
			if (difference < minDifference[unit]){
				minDifference[unit] = difference;
			}
		}
	}

	// Índices con los que cortaremos los arreglos del objeto a retornar
	const r_firstIndex        = len_MinusOne - lastIndex;
	const r_lastIndex_PlusOne = len_MinusOne - firstIndex + 1;

	let yValues = gammaRayValues.yValues.slice(r_firstIndex, r_lastIndex_PlusOne);

	return({
		xValuesMeters: gammaRayValues.xValuesMeters.slice(r_firstIndex, r_lastIndex_PlusOne),
		xValuesFeet:   gammaRayValues.xValuesFeet.slice(r_firstIndex, r_lastIndex_PlusOne),
		yValues,

		numberMeasurements: yValues.length,
		// Siempre es necesario conservar los valores mayor y menor valor de gamma-ray originales
		maxYValue: gammaRayValues.maxYValue,
		minYValue: gammaRayValues.minYValue,
		minDifference,
	})
}