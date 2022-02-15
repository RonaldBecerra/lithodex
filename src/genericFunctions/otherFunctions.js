import * as Regex from '../constants/regularExpressions'
import shortid from 'shortid'

/* Función que recibe un número expresado en cadena de caracteres. 
   Devuelve un arreglo con dos valores: 
   (1) el mismo número pero habiéndole quitado el punto decimal, y 
   (2) el número de veces que habría que correr el punto decimal a la izquierda, (empezando desde el extremo derecho), para obtener de nuevo el mismo número 
*/
function integerAndExponent(text){
	// Primero procedemos a separar el número de acuerdo a la letra "e", de "exponente" ya que algunos números en 
	// punto flotante vendrán expresados con la potencia precedida por dicha letra
	const e_separation = text.split("e");

	// Cantidad de veces que la letra "e" indica que hay que correr el punto decimal a la izquierda.
	// (Es necesario invertir el signo)
	var addedDecimals = (e_separation[1] != null) ? (-1 * e_separation[1]) : 0;

	// Ahora separamos de nuevo el número pero de acuerdo al punto decimal
	const dot_separation = e_separation[0].split('.');

	// Éste es el número equivalente al que estamos trabajando si no tuviese los decimales
	var noDecimalsNumber = dot_separation[0];

	if (dot_separation[1] != null){
		noDecimalsNumber += dot_separation[1];
		addedDecimals += dot_separation[1].length;
	}
	return [parseInt(noDecimalsNumber), addedDecimals];
}

/* Función que recibe un número, que puede estar expresado en punto flotante, y lo devuelve expresado como
   cadena de caracteres sin hacer uso de las potencias. Esto es importante cuando tenemos algo como "3.09482e-9", 
   y queremos obtener su notación sin el "e-9", es decir, 0.00000000309482.
 */
function stringNumber(number, addedDecimals=null){
	// En este caso se supone que recibimos un número expresado en punto flotante, por lo que tenemos que ver
	// cuántos decimales hay. Recuérdese que puede haber aparecido una potencia con la letra "e".
	if (addedDecimals == null){
		var intAndExp     = integerAndExponent(number.toString());
		var integerNumber = intAndExp[0];
		addedDecimals     = intAndExp[1];

		var string = integerNumber.toString();
	} else { // En este caso se supone que "number" es un entero, y los decimales ya nos los indica la entrada
		var string = number.toString();
	}

	if (addedDecimals != 0){
		// Determinamos la cantidad de ceros a añadir después del punto decimal si es que la mantisa está después del punto decimal.
		// Por ejemplo, en 0.00003, la cantidad de ceros sería 4.
		const numberZerosToAdd_beginning = addedDecimals - string.length;

		if (numberZerosToAdd_beginning >= 0){
			string = "0" + "." + "0".repeat(numberZerosToAdd_beginning) + string;
		}
		else if (numberZerosToAdd_beginning < 0){
			string = string.slice(0, -numberZerosToAdd_beginning) + "." + string.slice(-numberZerosToAdd_beginning);
		}
	}
	return string;
}

/* Función que recibe un número y lo acorta de modo que su cadena correspondiente sólo tenga hasta 
   N caracteres (incluyendo el punto decimal). Entonces le quita los ceros que queden más a la derecha
   del número, en caso de que éste tenga parte decimal. El resultado es redondeado, no truncado.

   Lo que devuelve es en realidad un arreglo de dos valores: el número en punto flotante, y el número
   como cadena de caracteres
 */
function numberRoundedToN(number, N){
	var string = stringNumber(number);

	// Si el número tiene N símbolos o menos, entonces lo podemos retornar directamente sin aplicarle ningún proceso
	// ya que no quedarán 0's a la derecha de las cifras significativas después del punto decimal
	if (string.length < N){
		const returnNumber = parseFloat(string);
		if (returnNumber == 0){
			return [0, "0"];
		}
		return [returnNumber, string];
	}
	// Caso contrario en que el número tiene más de N símbolos
	var indexDot      = string.indexOf("."); // Índice en el que aparece el punto decimal
	var provNumber    = null;
	var trimmedString = string; 

	if (indexDot >= N-1){
		provNumber = parseFloat(string).toFixed(0);
		trimmedString = stringNumber(provNumber).substring(0,N);
	}
	else if (0 < indexDot){
		provNumber = parseFloat(string).toFixed(N-indexDot-1);
		trimmedString = stringNumber(provNumber);

		// Aquí procedemos a eliminar los 0's que sobraron
		var numberZerosToEliminate = 0;

		for (i = N-1; i > indexDot; i--){
			if (trimmedString[i] == "0"){
				numberZerosToEliminate += 1;
			} else {
				break;
			}
		}
		trimmedString = trimmedString.substring(0, N-numberZerosToEliminate);
		const len_MinusOne = trimmedString.length - 1;

		if (trimmedString[len_MinusOne] == "."){
			trimmedString = trimmedString.substring(0,len_MinusOne);
		}	
	} 

	const returnNumber = parseFloat(trimmedString);
	if (returnNumber == 0){
		return [0, "0"];
	}
	return [returnNumber, trimmedString];
}

/* Función que recibe un número entero, y también recibe un exponente para luego transformar ese 
   entero en decimal. Si reconoce un patrón de cinco 9's seguidos, aumenta en uno la última cifra 
   que no era 9 a la izquierda de la cadena, y transforma el resto en 0's. Esto permite convertir
   números como 0,9999... en 1. Recibe además un número N que indica a cuántos símbolos debe luego
   truncarse el número, para lo cual se usa la función auxiliar numberCutToN.

   Lo que devuelve es en realidad un arreglo de dos valores: el número en punto flotante, y el número
   como cadena de caracteres.
 */
function eliminatedNinesNumber(integerNumber,exponent, N){
	if (N <= 0){
		return [null, null];
	}

	/* Sólo eliminamos la cadena de cinco 9's seguidos si la diferencia entre el número convertido
       y el número original es menor que 0.01. Esta toletancia fue elegida arbitrariamente*/
	const TOLERANCE = 0.01; 

	//const originalNumber = integerNumber * Math.pow(10,exponent);
	const originalNumber = parseFloat(stringNumber(integerNumber, -exponent));

	const string = integerNumber.toString();
	const len    = string.length; 

	var numberOfNinesInARow = 0; // Cantidad de 9's seguidos que hemos conseguido
	var condition = true;  // 
	var returnNumber  = originalNumber;
	var roundedNumber = null;

	for (var i = len-1; i >= 0; i--){
		if (string[i] == '9'){
			numberOfNinesInARow += 1;
		}
		else {
			if (numberOfNinesInARow > 4){
				// En este caso construimos el nuevo número
				var digit = parseInt(string[i]) + 1;
				var string2 = "";
				for (var k = 0; k < i; k ++){
					string2 += string[k];
				}
				string2 += digit.toString();
				for (k = i+1; k < len; k ++){
					string2 += "0";
				}
				roundedNumber = parseFloat(stringNumber(parseInt(string2), -exponent));
				if (roundedNumber - originalNumber < TOLERANCE){
					returnNumber = roundedNumber;
				}
				else {
					condition = false;
					break;
				}
			}
			numberOfNinesInARow = 0;
		}
	}
	if (condition && (numberOfNinesInARow > 4)){
		// En este caso construimos el nuevo número
		string2 = "1"
		for (i = 0; i < len; i++){
			string2 += "0";
		}
		const roundedNumber = parseFloat(stringNumber(parseInt(string2), -exponent));
		if (roundedNumber - originalNumber < TOLERANCE){
			return numberRoundedToN(roundedNumber, N);
		}
	}
	return numberRoundedToN(returnNumber, N);	
}

/* Función que convierte un número expresado en metros a su valor correspondiente en pies.

   Devuelve el número con hasta 10 símbolos, porque recuérdese que en los cuadros de texto 
   de los formularios en donde se ingresan números con unidades de medición establecimos que 
   se muestran hasta 10 caracteres si estamos trabajando con pies.

   Lo que devuelve es en realidad un arreglo de dos valores: el número en punto flotante, y el número
   como cadena de caracteres.
 */
export function metersToFeet(numberText){
	if (numberText == null){
		return [null, null];
	}

	if (typeof(numberText) == 'number'){
		numberText = numberText.toString();
	}
	const result = integerAndExponent(numberText);
	return eliminatedNinesNumber(result[0] * 32808, -4-result[1], 10);
}

/* Función que convierte un número expresado en pies a su valor correspondiente en metros.

   Devuelve el número con hasta 9 símbolos, porque recuérdese que en los cuadros de texto 
   de los formularios en donde se ingresan números con unidades de medición establecimos que 
   se muestran hasta 9 caracteres si estamos trabajando con metros. 

   Lo que devuelve es en realidad un arreglo de dos valores: el número en punto flotante, y el número
   como cadena de caracteres.
 */
export function feetToMeters(numberText){
	if (numberText == null){
		return [null, null];
	}

	if (typeof(numberText) == 'number'){
		numberText = numberText.toString();
	}
	const result = integerAndExponent(numberText);
	return eliminatedNinesNumber(result[0] * 30480370, -8-result[1], 9);
}

/* Función que recibe un número (no cadena de caracteres), y lo deja sólo con N símbolos, eliminando
   cualquier secuencia de cinco 9's seguidos. Además si quedan ceros al extremo derecho habiendo un punto decimal,
   se eliminan. También recibe un número N, que indica a cuántos caracteres debe truncarse el número.

   Lo que devuelve es en realidad un arreglo de dos valores: el número en punto flotante, y el número
   como cadena de caracteres.
 */
export function repairNumber(number, N){
	if ((number == null) || (N < 0)){
		return [null,null];
	}
	if (typeof(number) == 'string'){
		number = parseFloat(number);
	}
	if (number == 0){
		return [0, "0"];
	}
	const string = number.toString();
	const result = integerAndExponent(string);
	if (result[1] != 0){
		return eliminatedNinesNumber(result[0], -result[1], N);
	}
	return [number,string];
}

// Función para validar una cadena de caracteres como un número decimal (sólo parte entera también se valida), pero no admite números negativos (admite el cero).
export function isValidPositiveDecimalNumber(text){
	if (Regex.REGULAR_EXPRESSION_1.test(text)){
		return true
	}
	return false;
}

// Función para validar una cadena de caracteres como un número decimal (sólo parte entera también se valida), y también admitiendo números negativos
export function isValidDecimalNumber(text){
	if (Regex.REGULAR_EXPRESSION_2.test(text) || Regex.REGULAR_EXPRESSION_3.test(text)){
		return true
	}
	return false;
}

// Función para validar una cadena de caracteres sólo cuando posee letras y números; ningún otro carácter adicional, aunque sí admite espacios
export function onlyLettersAndNumbers(text){
	if (Regex.REGULAR_EXPRESSION_4.test(text)){
		return true
	}
	return false;
}

// Función para determinar si una expresión regular corresponde a un correo electrónico
export function isValidEmail(text){
	if (Regex.REGULAR_EXPRESSION_6.test(text)){
		return true;
	}
	return false;
}

/* Función para determinar si una cadena de caracteres llamada "string" incluye a otra subcadena llamada "substring",
   haciendo caso omiso de las mayúsculas y minúsculas, y de los acentos */
export function stringIncludesSubstring_NoStrict(string,substring){
	if (string.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(substring.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))){
		return true;
	}
	else {
		return false;
	}
} 

// Se utiliza para crear los identificadores de los objetos de estudio: núcleos y afloramientos
export function generateObject_id(){
	return "obj" + "_" + shortid.generate() + "_" + new Date().getTime();
}

/* Se utiliza para generar los identificadores de los usuarios del sistema.
   Tenemos que pasar las letras mayúsculas a minúsculas porque PouchDB no admite mayúsculas en los nombres de bases de datos
   Ellos ponen este mensaje:
     "Only lowercase characters (a-z), digits (0-9), and any of the characters _, $, (, ), +, -, and / are allowed. 
       Must begin with a letter." 
*/
export function generateUser_id(){
	return "usr_" + shortid.generate().toLowerCase() + "_" + new Date().getTime();
}

// Generador de clave en el que se mezcla el tiempo actual con un id generado automáticamnte por la función "shortid".
// Se utiliza para generar los identificadores de los estratos de un objeto de estudio, y de las imágenes en general.
export function generate_key(){
	return "key_" + shortid.generate() + "_" + new Date().getTime();
}

// Obtención del máximo elemento entre dos valores numéricos. Se diferencia de la función Math.max en que ignora valores nulos
// en lugar de considerarlos como cero
export function max(number1,number2){
	if (typeof(number1) == 'string'){
		number1 = parseFloat(number1);
	}
	if (typeof(number2) == 'string'){
		number2 = parseFloat(number2);
	}

	if (number1 == null){
		return number2;
	}
	if (number2 == null){
		return number1;
	}
	return Math.max(number1, number2);
}

// Obtención del mínimo elemento entre dos valores numéricos. Se diferencia de la función Math.min en que ignora valores nulos
// en lugar de considerarlos como cero
export function min(number1,number2){
	if (typeof(number1) == 'string'){
		number1 = parseFloat(number1);
	}
	if (typeof(number2) == 'string'){
		number2 = parseFloat(number2);
	}

	if (number1 == null){
		return number2;
	}
	if (number2 == null){
		return number1;
	}
	return Math.min(number1, number2);
}

// Función que recibe un objeto JavaScript y retorna el mismo objeto pero con sus propiedades ordenadas lexicográficamente
export function orderObject(unordered){
	return Object.keys(unordered).sort().reduce(
		(obj, key) => { 
			obj[key] = unordered[key]; 
			return obj;
		}, 
		{}		
	)
}

// Función que recibe un objeto JavaScript y determina si está vacío o no
// Fuente: https://coderwall.com/p/_g3x9q/how-to-check-if-javascript-object-is-empty
export function isEmptyObject(obj){
	for (var key in obj){
		if (obj.hasOwnProperty(key)){
			return false;
		}
	}
	return true;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////   P  R  U  E  B  A  S   /////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function test(){
	var boolean = true;
	var string  = null;

	// En este número deben haberse eliminado los 9's
	string  = "8382.83999997489378299999";
	boolean = boolean && (repairNumber(string, 20)[1] === "8382.84");

	// En este número deben haberse eliminado los 9's
	string  = "6.99999199999";
	boolean = boolean && (repairNumber(string, 20)[1] === "7");

	// En este número deben haberse eliminado los 9's
	string  = "99999.9999";
	boolean = boolean && (repairNumber(string, 20)[1] === "100000");

	// En este número no se eliminan los 9's
	string  = "9999.938382";
	boolean = boolean && (repairNumber(string, 20)[1] === "9999.938382");

	// Conversión esperada de pies a metros
	string  = "3.2808";
	boolean = boolean && (feetToMeters(string)[1] === "1");

	// Conversión esperada de metros a pies. Esto realmente debería arrojar como resultado 0.00000032808, pero como cortamos a diez símbolos y redondeamos,
	// entonces el 2 debe convertirse en un 3.
	string  = "0.0000001";
	boolean = boolean && (metersToFeet(string)[1] === "0.00000033");

	// Conversión esperada de metros a pies. Esto realmente debería arrojar como resultado 0.0000032808, pero como cortamos a diez símbolos y redondeamos,
	// entonces el 0 que está entre los dos 8's debe convertirse en un 1.
	string  = "0.000001";
	boolean = boolean && (metersToFeet(string)[1] === "0.00000328");

	// El signo menos se considera como un decimal válido, puesto que el usario sigue sin haber escrito el número completo, pero no es un positivo válido
	string  = "-"
	boolean = boolean && isValidDecimalNumber(string) && (!isValidPositiveDecimalNumber(string));

	// El cero se incluye entre los validados como positivos
	string  = "0"
	boolean = boolean && isValidPositiveDecimalNumber(string);

	// Esta cadena de caracteres sólo tiene letras y números. Pero no puede ser considerada un número decimal
	string  = "fhK1939292ooe"
	boolean = boolean && onlyLettersAndNumbers(string) && (!isValidDecimalNumber(string)) && (!isValidPositiveDecimalNumber(string));

	// También se reconocen como letras aquéllas que tienen acentos de distintos tipos
	string  = "íüùÍÜÙ"
	boolean = boolean && onlyLettersAndNumbers(string);

	// Reconocer subcadenas no estrictas válidas, es decir, que no importa si se agregaron/quitaron acentos, o si no corresponden las mayúsculas con las minúsculas
	string  = "Mi perro ladró"
	boolean = boolean && stringIncludesSubstring_NoStrict(string, "mÍ") && stringIncludesSubstring_NoStrict(string, "erro") && stringIncludesSubstring_NoStrict(string, " lad") 
	          && (!stringIncludesSubstring_NoStrict(string, "ferro")) && stringIncludesSubstring_NoStrict(string, " ladro");

	// Reconocer subcadenas no estrictas válidas, en este caso incluyendo otros tipos de acentos
	string  = "pingüino àlto"
	boolean = boolean && stringIncludesSubstring_NoStrict(string, "pinguino alto");

	// Reconocer la cadena vacía como subcadena de cualquier otra
	string  = "Casa"
	boolean = boolean && stringIncludesSubstring_NoStrict(string, "");

	// Obtención del máximo elemento entre dos valores
	boolean = boolean && (max(null,-23) == -23) && (max(null,5) == 5) && (max(3,-23) == 3);

	// Obtención del mínimo elemento entre dos valores
	boolean = boolean && (min(null,-23) == -23) && (min(null,5) == 5) && (min(3,-23) == -23);

	return boolean;
}