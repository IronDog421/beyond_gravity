// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;

// 1-inicializa 
init();
// 2-Crea una escena
loadScene();
// 3-renderiza
render();

function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 1000 );
  camera.position.set( 300, 300, 300 );

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );
  window.addEventListener('resize', updateAspectRatio );
}


function loadScene() {
    
    //////////////////
    /////MATERIALS////
    //////////////////
    let blackMaterial = new THREE.MeshBasicMaterial({ color: 0x819efc });
    let yellowMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    let redMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    let blueMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    let greenMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    let transparentMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });

    //////////////////
    //////FLOOR///////
    //////////////////
    let floor = new THREE.Mesh(new THREE.BoxGeometry(1000, 0, 1000), blackMaterial);
    scene.add(floor); 


    //////////////////
    //////ROBOT///////
    //////////////////
    let robot = new THREE.Object3D();
    scene.add(robot);

    //////////////////
    ///////BASE///////
    //////////////////
    let base = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 15, 32), transparentMaterial);
    base.position.setY(7.5);
    robot.add(base);

    //////////////////
    //////BRAZO///////
    //////////////////
    let brazo = new THREE.Object3D(); // Nodo contenedor para el brazo
    base.add(brazo);

    //////////////////
    ///////EJE////////
    //////////////////
    let eje = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 18, 32), transparentMaterial);
    eje.rotateX(Math.PI / 2);
    brazo.add(eje);

    //////////////////
    ////ESPARRAGO/////
    //////////////////
    let esparrago = new THREE.Mesh(new THREE.BoxGeometry(18, 120, 12), blueMaterial);
    esparrago.position.setY(60);
    brazo.add(esparrago);

    //////////////////
    //////ROTULA//////
    //////////////////
    let rotule = new THREE.Mesh(new THREE.SphereGeometry(20, 20, 20), transparentMaterial);
    rotule.position.setY(120)
    brazo.add(rotule)

    //////////////////
    ////ANTEBRAZO/////
    //////////////////
    let antebrazo = new THREE.Object3D(); // Nodo contenedor para el antebrazo
    antebrazo.position.setY(120);
    brazo.add(antebrazo);

    //////////////////
    //////DISCO///////
    //////////////////
    let disco = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 6, 32), transparentMaterial);
    antebrazo.add(disco);

    //////////////////
    /////NERVIOS//////
    //////////////////
    let nervio1 = new THREE.Mesh(new THREE.BoxGeometry(4, 80, 4), redMaterial);
    nervio1.position.set(8, 40, 8);
    antebrazo.add(nervio1);
    let nervio2 = new THREE.Mesh(new THREE.BoxGeometry(4, 80, 4), redMaterial);
    nervio2.position.set(-8, 40, 8);
    antebrazo.add(nervio2);
    let nervio3 = new THREE.Mesh(new THREE.BoxGeometry(4, 80, 4), redMaterial);
    nervio3.position.set(8, 40, -8);
    antebrazo.add(nervio3);
    let nervio4 = new THREE.Mesh(new THREE.BoxGeometry(4, 80, 4), redMaterial);
    nervio4.position.set(-8, 40, -8);
    antebrazo.add(nervio4);

    //////////////////
    ///////MANO///////
    //////////////////
    let mano = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 40, 32), greenMaterial);
    mano.rotateX(Math.PI / 2);
    mano.position.setY(80);
    antebrazo.add(mano);

    //////////////////
    //////PINZAIZ/////
    //////////////////
    let paralelepipediz = new THREE.Mesh(new THREE.BoxGeometry(19, 4, 20), redMaterial)
    paralelepipediz.translateX(10)
    paralelepipediz.translateY(8)

    let geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
        // Cara 1
        0, 0, 4,
        19, 2, 4,
        19, 18, 4,
        0, 20, 4,

        // Cara 2
        0, 0, 0,
        19, 2, 0,
        19, 18, 0,
        0, 20, 0,
    ]);

    const indices = [
      // Cara frontal (z=4)
      0, 1, 2,
      0, 2, 3,

      // Cara trasera (z=0)
      4, 6, 5,
      4, 7, 6,

      // Cara derecha (x=19)
      1, 5, 6,
      1, 6, 2,

      // Cara izquierda (x=0)
      0, 3, 7,
      0, 7, 4,

      // Cara superior (y=20)
      3, 2, 6,
      3, 6, 7,

      // Cara inferior (y=0)
      0, 4, 5,
      0, 5, 1
    ];


    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);

    let pinzaiz = new THREE.Mesh(geometry, redMaterial);
    pinzaiz.rotateX(Math.PI/2)
    pinzaiz.translateX(9.5)
    pinzaiz.translateY(-10)
    pinzaiz.translateZ(-2)
    paralelepipediz.add(pinzaiz);
    mano.add(paralelepipediz);


    //////////////////
    //////PINZAIZ/////
    //////////////////
    let paralelepipedde = paralelepipediz.clone();
    paralelepipedde.translateY(-20)
    mano.add(paralelepipedde);

    //show axes
    var axes = new THREE.AxesHelper( 200 );
    scene.add(axes);
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
}

function render()
{
	requestAnimationFrame( render );
	update();
	renderer.render( scene, camera );
}