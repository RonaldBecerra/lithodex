#!/usr/bin/python
# -*- coding: utf-8 -*-
#
# Archivo: postInstallation.py
# 
# Descripción: Sirve para arreglar la línea que se pone incorrecta en el archivo
#              blacklist.js cuando se instala una nueva librería. Este problema
#              solo ocurre si se está usando una versión de Node posterior a la
#              12.10.0.
#              
#              Desde que actualicé la versión de Expo SDK a la 38, también se 
#              daña una línea del archivo siguiente, lo cual genera un warning:
#              "node_modules/react-native-safe-area-view/index.js"
#
#              Esto último se debe a que en las librerías, cuando se usaba 
#              algo como "ref.getNode()", ya no hace falta el "getNode()" sino
#              que con invocar directamente a "ref" ya es suficiente.
#                 
# Ejecución: Debe invocarse con un comando de Python en la terminal, como
#            "python postInstall.py", o haciendo "run" en el IDLE de Windows
#            si este archivo se abrió con el mismo.
#              


import os
import sys

rutaActual = os.getcwd()
ruta_blacklist = rutaActual + "/node_modules/metro-config/src/defaults/blacklist.js"
ruta_safe_area_view = rutaActual + "/node_modules/react-native-safe-area-view/index.js"
    

# Arreglar el archivo blacklist
try:
    archivo = open(ruta_blacklist)
except:
    print(">>> ERROR: El archivo de la ruta blacklist no existe.")
    sys.exit()

lineasTotales = []
salida = ""

for lineaPrev in archivo:
    linea = lineaPrev.split("\n")
    lineasTotales.append(linea)

lineasTotales[14][0] = '  /node_modules[\\/\\\\]react[\\/\\\\]dist[\\/\\\\].*/,'
for linea in lineasTotales:
    salida += linea[0]
    salida += "\n"
archivo.close()

archivo = open(ruta_blacklist,"w")
archivo.write(salida)
archivo.close()

# Arreglar el archivo index de safe-area-view

try:
    archivo = open(ruta_safe_area_view)
except:
    print(">>> ERROR: El archivo de la ruta safe-area-view no existe.")
    sys.exit()

lineasTotales = []
salida = ""

for lineaPrev in archivo:
    linea = lineaPrev.split("\n")
    lineasTotales.append(linea)

lineasTotales[191][0] = '    this.view.measureInWindow((winX, winY, winWidth, winHeight) => {'
for linea in lineasTotales:
    salida += linea[0]
    salida += "\n"
archivo.close()

archivo = open(ruta_safe_area_view,"w")
archivo.write(salida)
archivo.close()


