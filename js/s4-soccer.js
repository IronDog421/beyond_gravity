// ejemplo integrador

var loader;
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;
var mixer = null;
const clock = new THREE.Clock();
var player;         // objeto que representa el jugador

// movimiento del jugador (sacado de s3-cam2.js)
// -------------------------------------------------------
var angulo = -0.01;
var speed = 0.1;
var p_pos = new THREE.Vector3(0,0,0);
var velocity = new THREE.Vector3(0,0,0);

// animaciones
const A_IDLE = 0;
const A_RUN = 1;
const A_PASS = 2

var timer_patear = 0;

const controls = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    speed: 0.1
};

// Event listeners para controles
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            controls.moveForward = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            controls.moveBackward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            controls.moveLeft = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            controls.moveRight = true;
            break;

        case 'Space':
            // Hacer que corra hacia a la pelota y patee
            timer_patear = 1;           // segundos
            changeAnimation(A_RUN); 
            break;

        // puedes agregar eventos para saltear y tirarse al piso 

    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            controls.moveForward = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            controls.moveBackward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            controls.moveLeft = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            controls.moveRight = false;
            break;
        case 'KeyF':
            first_person = !first_person;
            break;
    }
});


// -------------------------------------------------------

// Mundo fisico
let world;
const groundMaterial = new CANNON.Material("groundMaterial");
const sphereMaterial = new CANNON.Material("sphereMaterial");
const playerMaterial = new CANNON.Material("playerMaterial");

init();
render();

function init()
{
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor( new THREE.Color(0xFFFFFF) );
    document.getElementById('container').appendChild( renderer.domElement );

    // mundo visual
    scene = new THREE.Scene();

    // Mundo fisico
  	world = new CANNON.World(); 
   	world.gravity.set(0,-9.8,0); 

    // Suelo
    // visual
	const suelo = new THREE.Mesh( new THREE.PlaneGeometry(100,50,1,1), new THREE.MeshPhongMaterial({ color: 0x009000 }));
	suelo.rotation.x = -Math.PI/2;
	suelo.position.y = -0.01;
    suelo.receiveShadow = true
	scene.add( suelo);
    // fisico
    // en cannon un plane es un plano infinito
    const groundShape = new CANNON.Plane();
    const ground = new CANNON.Body({ mass: 0, material: groundMaterial });
    ground.addShape(groundShape);
	ground.position.y = -0.01;
    ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
    world.addBody(ground);
    // relacion entre fisico y visual
    suelo.body = ground;

    // Pelota 
    // Esfera - Visual (Three.js)
    sphereMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 32, 32), 
        new THREE.MeshPhongMaterial()
    );
    sphereMesh.position.set(2, 10, 0); // Posición inicial
    sphereMesh.castShadow = true;
    scene.add(sphereMesh);
    // Esfera - Física (Cannon.js)
    const sphereShape = new CANNON.Sphere(0.1); 
    const sphereBody = new CANNON.Body({ mass: 1, material:sphereMaterial });
    sphereBody.addShape(sphereShape);
    sphereBody.position.copy(sphereMesh.position); // Sincronizar posición inicial
    sphereBody.linearDamping = 0.3;   // frena el movimiento lineal
    sphereBody.angularDamping = 0.4;  // frena la rotación
    world.addBody(sphereBody);
    // Relación física-visual
    sphereMesh.body = sphereBody;

    // Crear un `ContactMaterial` para definir la interacción entre la esfera y el suelo
    const sphereGroundContactMaterial = new CANNON.ContactMaterial(
        groundMaterial,
        sphereMaterial,
        {
            friction: 0.4,         // Coeficiente de fricción
            restitution: 0.3       // Coeficiente de restitución (elasticidad)
        }
    );
    world.addContactMaterial(sphereGroundContactMaterial);   
    
    player

    // Jugador - Visual (Three.js)
    const playerMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 1.8, 0.5),   // ancho, alto, profundo (aprox humano)
        new THREE.MeshPhongMaterial({ color: 0x0000ff, opacity: 0.1, transparent: true })
    );
    playerMesh.position.set(0, 0.9, 0); // mitad de la altura en Y
    playerMesh.castShadow = true;
    scene.add(playerMesh);

    // Jugador - Física (Cannon.js)
    // Box recibe un HALF-EXTENT, es decir, la mitad de cada dimensión, 
    const halfExtents = new CANNON.Vec3(0.9, 0.9, 0.9); // las componentes son: 
    const playerShape = new CANNON.Box(halfExtents);
    playerBody = new CANNON.Body({
        mass: 0,  // como el jugador lo movemos a mano, lo dejamos estatico
        material: playerMaterial
    });
    playerBody.addShape(playerShape);
    playerBody.position.copy(playerMesh.position);
    world.addBody(playerBody);
    // Relación física-visual
    playerMesh.body = playerBody;

    const playerBallContactMaterial = new CANNON.ContactMaterial(
        playerMaterial,
        sphereMaterial,
        {
            friction: 0.4,
            restitution: 0.2
        }
    );
    world.addContactMaterial(playerBallContactMaterial);

  // cargo el objeto y las animaciones
  loadModelAndAnimations();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.01, 150 );
  camera.position.set( 0, 5, 15);

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );

  const light1 = new THREE.PointLight(0xffffff, 1, 10000);
  light1.position.set(-50, 50, -50);
  scene.add(light1);
  const light2 = new THREE.PointLight(0xffffff, 1, 10000);
  light2.position.set(50, 50, 50);
  scene.add(light2);
  
  // Luz ambiental para afectar a todos los objetos de manera uniforme
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);
  

  window.addEventListener('resize', updateAspectRatio );
}


let actions = {};
// Array para almacenar los nombres de las animaciones
let animationNames = [];
// Índice actual de la animación
let currentAnimationIndex = 0;


function loadModelAndAnimations() {
    const loader = new THREE.FBXLoader();

    // Cargar modelo base
    loader.load('./models/shanon/Pumpkinhulk L Shaw.fbx', function (object) {

        player = object;
        scene.add(object);
        object.position.set(0, 0, 0);

        // Vamos a ajustar el tamaño del mesh para que su altura sea 2 metros.
        var box = new THREE.Box3().setFromObject(object);
        var size = new THREE.Vector3();
        box.getSize(size);
        var s = 2.0 / size.y;
        object.scale.set(s,s,s );


        mixer = new THREE.AnimationMixer(object);

        // Ajustar materiales
        object.traverse(function (child) {
            if (child.isMesh) {
                child.material.transparent = false;
                child.material.opacity = 1.0;
            }
        });

        // Cargar y aplicar animaciones
        const animations = ['./models/shanon/Standing Idle.fbx', './models/shanon/Fast Run.fbx', './models/shanon/Soccer Pass.fbx'];
        animations.forEach(function (animFile, index) {
            loader.load(animFile, function (animData) {
                // Extraer el nombre del archivo sin la ruta ni la extensión .fbx
                const name = animFile.split('/').pop().split('.').slice(0, -1).join('.');
                const action = mixer.clipAction(animData.animations[0]);
                actions[name] = action; // Guardar la acción con el nombre del archivo
                animationNames[index] = name; // Almacenar nombre de animación en el array
                
                if (index === 0) { // Iniciar la primera animación
                    action.play();
                }                                
            });
        });

    }, undefined, function (error) {
        console.error(error);
    });
}

function changeAnimation(index) {

    if(currentAnimationIndex==index)
        return;
    // Reproducir la nueva animación
    actions[animationNames[index]].play();
    // Detener la animación anterior
    actions[animationNames[currentAnimationIndex]].stop();
    currentAnimationIndex = index;
}


function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update()
{
    // Cambios para actualizar la camara segun mvto del raton
    cameraControls.update();
    const delta = clock.getDelta();         // tiempo en segundos
    if (mixer!=null) mixer.update(delta);

    if(player==null) 
        return;



    if(timer_patear>0)
    {
        timer_patear -= delta;
        
        let dist = new THREE.Vector3().subVectors(sphereMesh.position, p_pos).length();
        if(dist>1.0) 
        {
            // Vector desde el jugador hasta la pelota
            velocity = new THREE.Vector3().subVectors(sphereMesh.position, p_pos);
            velocity.y = 0;
            velocity.normalize();
            // Calcular ángulo en el plano XZ
            angulo = Math.atan2(velocity.x, velocity.z);
        }
        
        // Actualizar el ángulo basado en los controles de izquierda y derecha
        if (controls.moveLeft) angulo += 0.05;
        if (controls.moveRight) angulo -= 0.05;

        // me muevo a donde esta la pelota
        p_pos.add(velocity.clone().multiplyScalar(controls.speed));

    }
    else
    {
        // Calcular el vector de dirección de vista
        velocity = new THREE.Vector3(Math.sin(angulo), 0, Math.cos(angulo));
        // Actualizar el ángulo basado en los controles de izquierda y derecha
        if (controls.moveLeft) angulo += 0.05;
        if (controls.moveRight) angulo -= 0.05;

        // mueve el personaje
        if (controls.moveForward) {
            changeAnimation(A_RUN);
            p_pos.add(velocity.clone().multiplyScalar(controls.speed));
        }
        else
            changeAnimation(A_IDLE);
    }

    player.position.set( p_pos.x, p_pos.y, p_pos.z);
    player.rotation.y = angulo;

    playerBody.position.set(p_pos.x, p_pos.y+0.5, p_pos.z);
    playerBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0), angulo);

    // le digo al motor de fisica que actualize el mundo
    world.step(1/60);
 
    // Sincronizar el mesh visual con el cuerpo físico
    // Recorre todos los objetos en la escena
    scene.traverse(function(obj) {
        // Verifica si el objeto tiene una propiedad `body` (CANNON.Body)
        if (obj.body !== undefined) {
            // Sincroniza la posición y rotación del objeto visual con el cuerpo físico
            obj.position.copy(obj.body.position);
            obj.quaternion.copy(obj.body.quaternion);
        }
    });

}

function render()
{
	requestAnimationFrame( render );
	update();
	renderer.render( scene, camera );
}

