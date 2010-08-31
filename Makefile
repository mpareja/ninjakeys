TARGET = kbd-mangler
OBJECTS = main.o scripting.o

#CFLAGS = -I/usr/include/mozjs -DXP_UNIX
#LDFLAGS = -lmozjs

CFLAGS = -I/usr/include/xulrunner-1.9.2.8/ -DXP_UNIX
LDFLAGS = -L/usr/lib/xulrunner-devel-1.9.2.8/sdk/lib -lmozjs

all : $(TARGET)

$(TARGET) : $(OBJECTS)
	gcc -o $(TARGET) $(LDFLAGS) $(OBJECTS)

main.o : main.c
	gcc -c $(CFLAGS) main.c
scripting.o : scripting.c scripting.h
	gcc -c $(CFLAGS) scripting.c

clean :
	rm -rf $(OBJECTS) $(TARGET)

