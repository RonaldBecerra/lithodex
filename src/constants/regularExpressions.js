/* Expresiones regulares
===========================

   - El símbolo ^ indica que empieza la expresión regular, y el símbolo $, que termina.
     Si no se coloca $ al final, puede aceptar cualquier cosa a la derecha de la primera parte si dicha 
     primera parte es correcta.

   - El ([0-9]) es para que lea dígitos.

   - El asterisco (*) es para indicar que el objeto anterior puede tener cero o más elementos. 
     En cambio, con el "más" (+), el objeto debe tener uno o más elementos, nunca cero.

   - El punto (.) es un metacarácter que acepta casi cualquier otro carácter, por lo que para aceptar sólo exactamente al punto
     debemos escaparlo, y como además nuestra expresión regular es un string, debe ir doblemente escapado (\\).

   - El signo de interrogación indica que el objeto anterior puede bien aparecer o no.

   - Los paréntesis son para agrupar expresiones. Habría que escaparlos para indicar que se quiere aceptar específicamente un paréntesis.

   - Si se dejan espacios entre los caracteres, esos espacios formarán parte de la expresión regular. 
     Así que no debemos dejar espacios si no es lo que realmente se está buscando.
*/


// Sólo números positivos
export var REGULAR_EXPRESSION_1 = RegExp("^(([0-9]+)(\\.[0-9]*)?)$");

// Cualquier número entero o decimal
export var REGULAR_EXPRESSION_2 = RegExp("^(-?([0-9]+)(\\.[0-9]*)?)$");

// Signo de menos, para que se reconozca como expresión válida cuando el usuario apenas ha escrito el signo menos
export var REGULAR_EXPRESSION_3 = RegExp("^-$");

// Expresión para aceptar sólo letras o números, ningún otro carácter adicional. 
export var REGULAR_EXPRESSION_4 = RegExp("[^\W_]"); 

// Uno o más espacios seguidos
export var REGULAR_EXPRESSION_5 = RegExp(/\s+/);

// Correo electrónico. 
// Obtenida de: https://regexr.com/3e48o
// También hay otra en: https://emailregex.com/
export var REGULAR_EXPRESSION_6 = RegExp(/[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/);
