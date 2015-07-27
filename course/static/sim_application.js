(function(){
angular.module('eau', [
  'ngMaterial',
  'eau.head-controller',
  'eau.navigation',
  'eau.simulation',
  'eau.simulation.compression',
  'eau.simulation.arch',
  'eau.simulation.tension',
  'eau.simulation.truss',
  'eau.simulation.beam',
  'eau.simulation.sdof'
])
.config(function($mdThemingProvider) {
  $mdThemingProvider.theme('default')
    .primaryPalette('grey')
    .accentPalette('blue')
    // .warnPallette('amber')
    ;
})
;

}).call(this);

(function() {
  var l10;

  l10 = Math.log(10);

  angular.module('eau.utilities.scientific', []).filter('scientific', function() {
    return function(number, digits) {
      var exponent, len, value;
      number = '' + number;
      len = number.length;
      exponent = number.length - 1;
      value = '' + number.charAt(0);
      if (digits) {
        value += '.' + number.substr(1, digits);
      }
      value += '*10^' + exponent;
      return value;
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.compression.materials', []).value('MaterialList', {
    "Concrete": {
      density: 23e3,
      elasticity: 20e6,
      stress: 70e3,
      color: 'bisque'
    },
    "Granite": {
      density: 27e3,
      elasticity: 80e6,
      stress: 150e3,
      color: 'slategrey'
    },
    "Plastic": {
      density: 27e3,
      elasticity: 2e6,
      stress: 50e3,
      color: 'honeydew'
    },
    "Glass": {
      density: 10e3,
      elasticity: 50e6,
      stress: 100e3,
      color: "paleturquoise"
    },
    "Steel": {
      density: 77e3,
      elasticity: 200e6,
      stress: 250e3,
      color: 'lightsteelblue'
    },
    "Wood": {
      density: 6e3,
      elasticity: 10e6,
      stress: 30e3,
      color: 'brown'
    },
    "Copper": {
      density: 87e3,
      elasticity: 100e6,
      stress: 150e3,
      color: "sienna"
    }
  }).value('MomentShapes', {
    "Square": {
      moment: function(b) {
        return Math.pow(b, 4) / 12;
      },
      crossSection: function(b) {
        return b * b;
      }
    },
    "Hollow Square": {
      moment: function(b) {
        var center, t, tube;
        t = b * .25;
        tube = Math.pow(b, 4);
        center = Math.pow(b - 2 * t, 4);
        return (tube - center) / 12;
      },
      crossSection: function(b) {
        var center, t, tube;
        t = b * .25;
        tube = b * b;
        center = Math.pow(b - 2 * t, 2);
        return tube - center;
      }
    },
    "Pipe": {
      moment: function(d) {
        return (Math.PI / 64) * Math.pow(d, 4);
      },
      crossSection: function(d) {
        return Math.PI * d * d * 1 / 4;
      }
    },
    "Hollow Pipe": {
      moment: function(d) {
        var center, pipe, t;
        t = d * .25;
        pipe = Math.pow(d, 4);
        center = Math.pow(d - 2 * t, 4);
        return (Math.PI / 64) * (pipe - center);
      },
      crossSection: function(d) {
        var center, pipe, t;
        t = d * .25;
        pipe = d * d;
        center = Math.pow(d - 2 * t, 2);
        return Math.PI * (pipe - center) * 1 / 4;
      }
    }
  });

}).call(this);

(function() {
  var Particle, SimulationFactory;

  Particle = (function() {
    function Particle(simulation, index) {
      this.simulation = simulation;
      this.index = index;
      Object.defineProperty(this, 'position', {
        get: function() {
          return [this.simulation.positions[this.index * 2], this.simulation.positions[this.index * 2 + 1]];
        }
      });
    }

    return Particle;

  })();

  SimulationFactory = function(WorkerSvc, $rootScope, $log) {
    var Simulation;
    Simulation = (function() {
      function Simulation(N, scripts1, generator) {
        var i;
        this.N = N;
        this.scripts = scripts1;
        this.generator = generator;
        this.dt = 16;
        this.running = false;
        this.worker = WorkerSvc.get('/simulation/verlet.coffee');
        this.worker.addEventListener('error', (function(e) {
          return $log.error(e);
        }));
        this.worker.addEventListener('message', (function(_this) {
          return function(arg) {
            var data, name;
            data = arg.data;
            return typeof _this[name = data.event] === "function" ? _this[name](data) : void 0;
          };
        })(this));
        this.positions = new Float64Array(this.N * 2);
        this.particles = (function() {
          var j, ref, results;
          results = [];
          for (i = j = 0, ref = this.N; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
            results.push(new Particle(this, i));
          }
          return results;
        }).call(this);
        this.reset();
        scripts.forEach((function(_this) {
          return function(path) {
            return _this.worker.postMessage({
              event: 'load',
              url: WorkerSvc.getURL(path)
            });
          };
        })(this));
      }

      Simulation.prototype.reset = function() {
        var data, event;
        this.generator.call(this);
        data = new Float64Array(this.positions);
        event = {
          event: 'reset',
          count: data.length,
          dimensions: 2,
          positions: data.buffer
        };
        return this.worker.postMessage(event, [data.buffer]);
      };

      Simulation.prototype.tick = function() {
        return this.worker.postMessage({
          event: 'tick',
          dt: this.dt
        });
      };

      Simulation.prototype.render = function(arg) {
        var positions;
        positions = arg.positions;
        positions = new Float64Array(positions);
        return requestAnimationFrame((function(_this) {
          return function() {
            if (_this.running) {
              _this.tick();
            }
            return $rootScope.$apply(function() {
              var i, j, ref, results;
              results = [];
              for (i = j = 0, ref = _this.N; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
                _this.positions[i * 2] = positions[i * 2];
                results.push(_this.positions[i * 2 + 1] = positions[i * 2 + 1]);
              }
              return results;
            });
          };
        })(this));
      };

      Simulation.prototype.run = function() {
        this.running = true;
        return this.tick();
      };

      Simulation.prototype.toggle = function() {
        if (this.running) {
          return this.running = false;
        } else {
          return this.run();
        }
      };

      return Simulation;

    })();
    return {
      build: function(a, b, c) {
        return new Simulation(a, b, c);
      }
    };
  };

  SimulationFactory.$inject = ['WorkerSvc', '$rootScope', '$log'];

  angular.module('eau.simulation.service', ['eau.workers']).factory('SimulationFactory', SimulationFactory);

}).call(this);

(function() {
  var Beam;

  Math.cotan = function(T) {
    return Math.cos(T) / Math.sin(T);
  };

  Beam = (function() {
    function Beam(from, to, load1) {
      this.from = from;
      this.to = to;
      this.load = load1;
    }

    return Beam;

  })();

  angular.module('eau.simulation.truss.shapes', []).value('Trusses', {
    Howe: {
      Center: function(span, height, load) {
        var A, B, C, D, E, F, FAB, FAC, FBC, FBD, FCD, FCE, FDF, FDG, FED, FEG, FFG, FFH, FGH, G, H, P, T, V, cT, h, hP, sT, w;
        h = height;
        P = load;
        hP = 0.5 * P;
        w = span / 4;
        T = Math.atan(h / w);
        sT = Math.sin(T);
        cT = Math.cotan(T);
        V = 2 * w;
        A = [-V, 0];
        B = [-w, h];
        C = [-w, 0];
        D = [0, h];
        E = [0, 0];
        F = [w, h];
        G = [w, 0];
        H = [V, 0];
        FAB = -hP / sT;
        FAC = hP * cT;
        FBD = -hP * cT;
        FBC = hP;
        FCE = P * cT;
        FCD = -hP / sT;
        FED = P;
        FEG = FCE;
        FDG = FCD;
        FDF = FBD;
        FFG = FBC;
        FFH = FAB;
        FGH = FAC;
        return {
          points: {
            A: A,
            B: B,
            C: C,
            D: D,
            E: E,
            F: F,
            G: G,
            H: H
          },
          beams: {
            AB: new Beam(A, B, FAB),
            AC: new Beam(A, C, FAC),
            BD: new Beam(B, D, FBD),
            BC: new Beam(B, C, FBC),
            CE: new Beam(C, E, FCE),
            CD: new Beam(C, D, FCD),
            DE: new Beam(D, E, FED),
            DG: new Beam(D, G, FDG),
            EG: new Beam(E, G, FEG),
            DF: new Beam(D, F, FDF),
            FG: new Beam(F, G, FFG),
            FH: new Beam(F, H, FFH),
            GH: new Beam(G, H, FGH)
          }
        };
      },
      Left: function(span, height, load) {
        var A, B, C, D, E, F, FAB, FAC, FBC, FBD, FCD, FCE, FDF, FDG, FED, FEG, FFG, FFH, FGH, G, H, P, T, V, cT, h, hP, qP, sT, tP, w;
        h = height;
        P = load;
        tP = 0.75 * P;
        hP = 0.50 * P;
        qP = 0.25 * P;
        w = span / 4;
        T = Math.atan(h / w);
        sT = Math.sin(T);
        cT = Math.cotan(T);
        V = 2 * w;
        A = [-V, 0];
        B = [-w, h];
        C = [-w, 0];
        D = [0, h];
        E = [0, 0];
        F = [w, h];
        G = [w, 0];
        H = [V, 0];
        FAB = -tP / sT;
        FAC = tP * cT;
        FBD = -tP * cT;
        FBC = tP;
        FCD = qP / sT;
        FCE = hP * cT;
        FED = 0;
        FEG = hP;
        FDG = -qP / sT;
        FDF = -qP * cT;
        FFH = -qP / sT;
        FFG = qP;
        FGH = qP * cT;
        return {
          points: {
            A: A,
            B: B,
            C: C,
            D: D,
            E: E,
            F: F,
            G: G,
            H: H
          },
          beams: {
            AB: new Beam(A, B, FAB),
            AC: new Beam(A, C, FAC),
            BD: new Beam(B, D, FBD),
            BC: new Beam(B, C, FBC),
            CE: new Beam(C, E, FCE),
            CD: new Beam(C, D, FCD),
            DE: new Beam(D, E, FED),
            DG: new Beam(D, G, FDG),
            EG: new Beam(E, G, FEG),
            DF: new Beam(D, F, FDF),
            FG: new Beam(F, G, FFG),
            FH: new Beam(F, H, FFH),
            GH: new Beam(G, H, FGH)
          }
        };
      },
      Even: function(span, height, load) {
        var A, B, C, D, E, F, FAB, FAC, FBC, FBD, FCD, FCE, FDF, FDG, FED, FEG, FFG, FFH, FGH, G, H, P, T, V, cT, h, hP, oP, sT, w;
        h = height;
        P = load / 3;
        hP = 0.5 * P;
        oP = 1.5 * P;
        w = span / 4;
        T = Math.atan(h / w);
        sT = Math.sin(T);
        cT = Math.cotan(T);
        V = 2 * w;
        A = [-V, 0];
        B = [-w, h];
        C = [-w, 0];
        D = [0, h];
        E = [0, 0];
        F = [w, h];
        G = [w, 0];
        H = [V, 0];
        FAB = -oP / sT;
        FAC = oP * cT;
        FBD = -oP * cT;
        FBC = oP;
        FCE = 2 * P * cT;
        FCD = -hP / sT;
        FED = P;
        FEG = FCE;
        FDG = FCD;
        FDF = FBD;
        FFG = FBC;
        FFH = FAB;
        FGH = FAC;
        return {
          points: {
            A: A,
            B: B,
            C: C,
            D: D,
            E: E,
            F: F,
            G: G,
            H: H
          },
          beams: {
            AB: new Beam(A, B, FAB),
            AC: new Beam(A, C, FAC),
            BD: new Beam(B, D, FBD),
            BC: new Beam(B, C, FBC),
            CE: new Beam(C, E, FCE),
            CD: new Beam(C, D, FCD),
            DE: new Beam(D, E, FED),
            DG: new Beam(D, G, FDG),
            EG: new Beam(E, G, FEG),
            DF: new Beam(D, F, FDF),
            FG: new Beam(F, G, FFG),
            FH: new Beam(F, H, FFH),
            GH: new Beam(G, H, FGH)
          }
        };
      }
    },
    Pratt: {
      Center: function(span, height, load) {
        var A, B, C, D, E, F, FAB, FAC, FBC, FBD, FBE, FCE, FDF, FED, FEF, FEG, FFG, FFH, FGH, G, H, P, T, V, cT, h, hP, sT, w;
        h = height;
        P = load;
        hP = 0.5 * P;
        w = span / 4;
        T = Math.atan(h / w);
        sT = Math.sin(T);
        cT = Math.cotan(T);
        V = 2 * w;
        A = [-V, 0];
        B = [-w, h];
        C = [-w, 0];
        D = [0, h];
        E = [0, 0];
        F = [w, h];
        G = [w, 0];
        H = [V, 0];
        FAB = -hP / sT;
        FAC = hP * cT;
        FBC = 0;
        FBD = -P * cT;
        FBE = hP / sT;
        FCE = hP * cT;
        FED = 0;
        FEF = FBE;
        FEG = FCE;
        FDF = FBD;
        FFG = FBC;
        FFH = FAB;
        FGH = FAC;
        return {
          points: {
            A: A,
            B: B,
            C: C,
            D: D,
            E: E,
            F: F,
            G: G,
            H: H
          },
          beams: {
            AB: new Beam(A, B, FAB),
            AC: new Beam(A, C, FAC),
            BC: new Beam(B, C, FBC),
            BD: new Beam(B, D, FBD),
            BE: new Beam(B, E, FBE),
            CE: new Beam(C, E, FCE),
            DE: new Beam(D, E, FED),
            DF: new Beam(D, F, FDF),
            EF: new Beam(E, F, FEF),
            EG: new Beam(E, G, FEG),
            FG: new Beam(F, G, FFG),
            FH: new Beam(F, H, FFH),
            GH: new Beam(G, H, FGH)
          }
        };
      },
      Left: function(span, height, load) {
        var A, B, C, D, E, F, FAB, FAC, FBC, FBD, FBE, FCE, FDF, FED, FEF, FEG, FFG, FFH, FGH, G, H, P, T, V, cT, h, hP, qP, sT, tP, w;
        h = height;
        P = load;
        tP = 0.75 * P;
        hP = 0.50 * P;
        qP = 0.25 * P;
        w = span / 4;
        T = Math.atan(h / w);
        sT = Math.sin(T);
        cT = Math.cotan(T);
        V = 2 * w;
        A = [-V, 0];
        B = [-w, h];
        C = [-w, 0];
        D = [0, h];
        E = [0, 0];
        F = [w, h];
        G = [w, 0];
        H = [V, 0];
        FAB = -tP / sT;
        FAC = tP * cT;
        FBC = P;
        FBD = -hP * cT;
        FBE = -qP / sT;
        FCE = FAC;
        FED = 0;
        FEF = qP / sT;
        FEG = qP * cT;
        FDF = -hP * cT;
        FFG = 0;
        FFH = -qP / sT;
        FGH = qP * cT;
        return {
          points: {
            A: A,
            B: B,
            C: C,
            D: D,
            E: E,
            F: F,
            G: G,
            H: H
          },
          beams: {
            AB: new Beam(A, B, FAB),
            AC: new Beam(A, C, FAC),
            BC: new Beam(B, C, FBC),
            BD: new Beam(B, D, FBD),
            BE: new Beam(B, E, FBE),
            CE: new Beam(C, E, FCE),
            DE: new Beam(D, E, FED),
            DF: new Beam(D, F, FDF),
            EF: new Beam(E, F, FEF),
            EG: new Beam(E, G, FEG),
            FG: new Beam(F, G, FFG),
            FH: new Beam(F, H, FFH),
            GH: new Beam(G, H, FGH)
          }
        };
      },
      Even: function(span, height, load) {
        var A, B, C, D, E, F, FAB, FAC, FBC, FBD, FBE, FCE, FDF, FED, FEF, FEG, FFG, FFH, FGH, G, H, P, T, V, cT, h, hP, oP, sT, tP, w;
        h = height;
        P = load / 3;
        hP = 0.5 * P;
        oP = 1.5 * P;
        tP = 2.0 * P;
        w = span / 4;
        T = Math.atan(h / w);
        sT = Math.sin(T);
        cT = Math.cotan(T);
        V = 2 * w;
        A = [-V, 0];
        B = [-w, h];
        C = [-w, 0];
        D = [0, h];
        E = [0, 0];
        F = [w, h];
        G = [w, 0];
        H = [V, 0];
        FAB = -oP / sT;
        FAC = oP * cT;
        FBC = P;
        FBD = -tP * cT;
        FBE = hP / sT;
        FCE = oP * cT;
        FED = 0;
        FEF = FBE;
        FEG = FCE;
        FDF = FBD;
        FFG = FBC;
        FFH = FAB;
        FGH = FAC;
        return {
          points: {
            A: A,
            B: B,
            C: C,
            D: D,
            E: E,
            F: F,
            G: G,
            H: H
          },
          beams: {
            AB: new Beam(A, B, FAB),
            AC: new Beam(A, C, FAC),
            BC: new Beam(B, C, FBC),
            BD: new Beam(B, D, FBD),
            BE: new Beam(B, E, FBE),
            CE: new Beam(C, E, FCE),
            DE: new Beam(D, E, FED),
            DF: new Beam(D, F, FDF),
            EF: new Beam(E, F, FEF),
            EG: new Beam(E, G, FEG),
            FG: new Beam(F, G, FFG),
            FH: new Beam(F, H, FFH),
            GH: new Beam(G, H, FGH)
          }
        };
      }
    }
  });

}).call(this);

(function() {
  angular.module('eau.title-service', []).service('TitleSvc', function() {
    return {
      title: 'Engineering Around Us'
    };
  });

}).call(this);

(function() {
  var WorkerSvc;

  WorkerSvc = (function() {
    function WorkerSvc(cache) {
      this.cache = cache;
      this.workers = {};
      this.URLs = {};
    }

    WorkerSvc.prototype.getURL = function(path) {
      var blob, logic;
      if (this.URLs[path] != null) {
        return this.URLs[path];
      }
      logic = this.cache.get(path);
      blob = new Blob([logic], {
        type: 'text/javascript'
      });
      return this.URLs[path] = window.URL.createObjectURL(blob);
    };

    WorkerSvc.prototype.get = function(path) {
      var code;
      if (this.workers[path] != null) {
        return this.workers[path];
      }
      code = this.getURL(path);
      return this.workers[path] = new Worker(code);
    };

    return WorkerSvc;

  })();

  WorkerSvc.$inject = ['$workerCache'];

  angular.module('workers', []);

  angular.module('eau.workers', ['workers']).factory('$workerCache', function($cacheFactory) {
    return $cacheFactory.get('workersCache');
  }).service('WorkerSvc', WorkerSvc);

}).call(this);

(function(){
angular.module('eau.head-controller', [
  'eau.title-service'
]).controller('HeadCtrl', function($scope, TitleSvc){
  $scope.title = TitleSvc.title;
});

}).call(this);

(function(){
var toRad = Math.PI / 180;
ArrowController.$inject = ['$scope'];
function ArrowController($scope){
  this.fill = this.fill || this.color;
  $scope.sin = function(thetaDeg){
    return Math.sin(thetaDeg * toRad);
  };
  $scope.cos = function(thetaDeg){
    return Math.cos(thetaDeg * toRad);
  };
}

angular.module('eau.arrow', [
  'arrow.template'
]).directive('arrow', function(){
  return {
    restrict: 'E',
    replace: true,
    templateNamespace: 'svg',
    templateUrl: 'arrow',
    controller: ArrowController,
    controllerAs: 'arrow',
    bindToController: true,
    scope: {
      tip: '=',
      length: '=',
      color: '=',
      rotation: '=',
      point: '=',
      fill: '@',
      weight: '@'
    }
  };
});

}).call(this);

(function() {
  var NavigationCtrl, SimulationNav;

  SimulationNav = function($stateProvider) {
    var simlist;
    simlist = [];
    return {
      sim: function(name, args) {
        if (arguments.length === 1) {
          args = name;
        } else {
          args.name = name;
        }
        if (!args.templateUrl) {
          args.template || (args.template = "<" + args.name + " />");
        }
        simlist.push(args);
        return $stateProvider.state(args.name, {
          url: "/" + args.name,
          views: {
            "simulation": args
          }
        });
      },
      $get: function() {
        return simlist;
      }
    };
  };

  SimulationNav.$inject = ['$stateProvider'];

  NavigationCtrl = function(sims) {
    this.sims = sims;
  };

  NavigationCtrl.$inject = ['SimulationNav'];

  angular.module('eau.navigation', ['ui.router', 'navigation.template']).provider('SimulationNav', SimulationNav).controller('NavigationCtrl', NavigationCtrl).directive('navigation', function() {
    return {
      restrict: 'E',
      templateUrl: 'navigation',
      controller: 'NavigationCtrl',
      controllerAs: 'nav'
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.arch', ['eau.navigation', 'eau.arrow', 'simulation.arch.template']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('arch', {
        title: 'Arch'
      });
    }
  ]).directive('arch', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation/arch',
      controller: function($scope) {
        $scope.simulation = {
          applied: 25,
          height: 200,
          span: 200
        };
        $scope.forall = function(n) {
          var i, results;
          return (function() {
            results = [];
            for (var i = 0; 0 <= n ? i < n : i > n; 0 <= n ? i++ : i--){ results.push(i); }
            return results;
          }).apply(this);
        };
        $scope.force = {
          vertical: function() {
            var L, v, w;
            w = $scope.simulation.applied;
            L = $scope.simulation.span;
            v = w * (L / 2);
            return Math.round(v);
          },
          horizontal: function() {
            var L, d, d8, h, w;
            d = $scope.simulation.height;
            d8 = d * 8;
            L = $scope.simulation.span;
            w = $scope.simulation.applied;
            h = w * L * L / d8;
            return Math.round(h);
          },
          compressive: function() {
            return $scope.force.horizontal();
          }
        };
        $scope.force.vertical.max = 75000;
        return $scope.force.horizontal.max = 1125000;
      }
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.arch.brick', ['simulation.arch.brick.template']).directive('brick', function() {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'simulation/arch/brick',
      templateNamespace: 'svg'
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.beam', ['simulation.beam.template', 'eau.utilities.scientific', 'eau.simulation.compression.materials', 'graphing.scales', 'graphing.svg', 'ngMaterial', 'eau.navigation', 'eau.arrow']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('beam', {
        title: 'Beam'
      });
    }
  ]).directive('beam', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation/beam',
      controller: function($scope, $location, MaterialList) {
        var B, absMax, s, setCurrentMaterial;
        $scope.setCurrentMaterial = setCurrentMaterial = function(materialName) {
          if (MaterialList[materialName] == null) {
            return;
          }
          $scope.materialName = materialName;
          return $scope.currentMaterial = {
            material: materialName,
            density: MaterialList[materialName].density,
            elasticity: MaterialList[materialName].elasticity,
            color: MaterialList[materialName].color,
            stress: MaterialList[materialName].stress
          };
        };
        $scope.materials = ['Steel', 'Wood', 'Concrete'];
        setCurrentMaterial('Steel');
        $scope.$watch('materialName', setCurrentMaterial);
        B = function(coef) {
          var base;
          base = Math.abs($scope.MaxM()) * coef / $scope.currentMaterial.stress;
          return Math.pow(base, 1 / 3);
        };
        $scope.crossSections = [
          {
            name: 'Solid',
            b: function() {
              return B(6);
            },
            t: function() {
              return 1;
            },
            area: function() {
              return this.b() * this.b();
            }
          }, {
            name: 'Hollow',
            b: function() {
              return B(0.0984);
            },
            t: function() {
              return 0.1 * this.b();
            },
            area: function() {
              var b, s, t;
              b = this.b();
              t = this.t();
              s = b - 2 * t;
              return (b * b) - (s * s);
            }
          }, {
            name: 'I-Beam',
            b: function() {
              return B(0.5947);
            },
            t: function() {
              return 0.1 * this.b();
            },
            area: function() {
              var b, beamArea, h, middleArea, s, t, totalArea;
              b = this.b();
              t = this.t();
              h = b * 1.5;
              s = b - 2 * t;
              totalArea = b * h;
              middleArea = (b - s) * h;
              beamArea = h * t;
              return totalArea - (middleArea - beamArea);
            }
          }
        ];
        $scope.crossSection = $scope.crossSections[0];
        s = $scope.simulation = {
          showBeam: $location.search().cross || false,
          length: 10,
          support: 8,
          load: {
            applied: 60,
            point: 5,
            loading: 'even'
          }
        };
        $scope.$watch('simulation.length', function(nv, ov) {
          var ratio;
          if (nv < 1) {
            s.length = nv = 1.0;
          }
          ratio = s.support / ov;
          s.support = nv * ratio;
          ratio = s.load.point / ov;
          s.load.point = nv * ratio;
        });
        $scope.$watch('simulation.support', function(v) {
          if (v > s.length) {
            return s.support = s.length;
          }
        });
        $scope.$watch('simulation.load.point', function(v) {
          if (v > s.length) {
            return s.load.point = s.length;
          }
        });
        $scope.forall = function(n) {
          var j, ref, results;
          return (function() {
            results = [];
            for (var j = 0, ref = Math.ceil(n); 0 <= ref ? j <= ref : j >= ref; 0 <= ref ? j++ : j--){ results.push(j); }
            return results;
          }).apply(this);
        };
        $scope.getXs = function() {
          var a, arr, c1, c2, c3, c4, c5, interpolate, l, trim;
          l = s.support;
          a = s.length - s.support;
          if (s.load.loading === 'even') {
            interpolate = function(arr, right) {
              var delta, left;
              if (arr.length === 0) {
                return [right];
              } else {
                left = arr[arr.length - 1];
                delta = right - left;
                return arr.concat([left + (delta / 4 * 1), left + (delta / 4 * 2), left + (delta / 4 * 3), right]);
              }
            };
            trim = function(arr, x) {
              if (x > 0) {
                arr = arr.concat(x);
              }
              return arr;
            };
            c1 = 0;
            c2 = (l / 2) * (1 - (a * a / (l * l)));
            c3 = l * (1 - (a * a) / (l * l));
            c4 = l;
            c5 = s.length;
            arr = l === 0 ? [0, s.length / 2, s.length] : a === 0 ? [0, l / 2, l] : [c1, c2, c3, c4, c5];
            arr = arr.reduce(interpolate, []).reduce(trim, []);
            arr.unshift(0);
            return arr;
          }
        };
        $scope.getMs = function() {
          var R1, a, l, ms, w, xs;
          l = s.support;
          a = s.length - l;
          if (s.load.loading === 'even') {
            w = s.load.applied * s.length;
            xs = $scope.getXs();
            R1 = $scope.V(1);
            return ms = xs.map(function(x) {
              if (l === 0) {
                x = a - x;
                return -w * x * x / 2;
              } else if (x <= l) {
                return ((w * x) / (2 * l)) * ((l * l) - (a * a) - (x * l));
              } else {
                x = x - l;
                return -(w / 2) * (a - x) * (a - x);
              }
            });
          }
        };
        $scope.moment = function($scales) {
          var line, ms, points, xs, zip;
          xs = $scope.getXs();
          ms = $scope.getMs();
          zip = function(x, i) {
            return [x, ms[i]];
          };
          points = xs.map(zip);
          if (s.support === 0) {
            points.push([0, 0]);
          }
          if ($scales) {
            points = points.map(function(p) {
              return [$scales.xa(p[0]), $scales.yme(p[1])];
            });
            line = d3.svg.line()(points) + 'z';
            return line;
          } else {
            return points;
          }
        };
        absMax = function(a, b) {
          if (Math.abs(a) > Math.abs(b)) {
            return a;
          } else {
            return b;
          }
        };
        $scope.MaxM = function() {
          if (s.load.loading === 'even') {
            return $scope.getMs().reduce(absMax, 0);
          } else {
            return $scope.pointMoment();
          }
        };
        $scope.pointMoment = function() {
          var P, a, b, l;
          a = s.load.point;
          l = s.support;
          P = s.load.applied;
          if (a <= l) {
            b = l - a;
            return P * a * b / l;
          } else {
            return -P * (a - l);
          }
        };
        $scope.MaxV = function() {
          if (s.support === 0) {
            if (s.load.loading === 'even') {
              return $scope.V(1);
            } else {
              return s.load.applied * s.length;
            }
          } else {
            if (s.load.loading === 'even') {
              return [$scope.V(1), $scope.V(2), $scope.V(3)].reduce(absMax, 0);
            } else {
              return absMax($scope.V(1), $scope.V(2));
            }
          }
        };
        return $scope.V = function(n) {
          var P, a, b, l, w;
          l = s.support;
          if (s.load.loading === 'even') {
            a = s.length - l;
            w = s.load.applied * s.length;
            if (l === 0) {
              return w * a;
            } else {
              switch (n) {
                case 1:
                  return (w / (2 * l)) * (l * l - a * a);
                case 2:
                  return w * a;
                case 3:
                  return (w / (2 * l)) * (l * l + a * a);
              }
            }
          } else if (s.load.loading === 'point') {
            P = s.load.applied;
            a = s.load.point;
            if (l === 0) {
              return -P;
            } else {
              if (a > l) {
                switch (n) {
                  case 1:
                    return -P * (a - l) / l;
                  case 2:
                    return P;
                }
              } else {
                b = l - a;
                switch (n) {
                  case 1:
                    return P * b / l;
                  case 2:
                    return -P * a / l;
                }
              }
            }
          }
        };
      }
    };
  });

}).call(this);

(function() {
  var GRAVITY, PI_SQUARED;

  PI_SQUARED = Math.PI * Math.PI;

  GRAVITY = 9.81;

  angular.module('eau.simulation.compression', ['eau.simulation.compression.materials', 'simulation.compression.template', 'eau.utilities.scientific', 'graphing.scales', 'graphing.svg', 'ngMaterial', 'eau.navigation']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('compression', {
        title: 'Column Compression'
      });
    }
  ]).directive('compression', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation/compression',
      controller: function($scope, MaterialList, MomentShapes) {
        var s, setCurrentMaterial, setCurrentShape;
        $scope.setCurrentMaterial = setCurrentMaterial = function(materialName) {
          if (MaterialList[materialName] == null) {
            return;
          }
          $scope.materialName = materialName;
          return $scope.currentMaterial = {
            material: materialName,
            density: MaterialList[materialName].density,
            elasticity: MaterialList[materialName].elasticity,
            color: MaterialList[materialName].color,
            stress: MaterialList[materialName].stress
          };
        };
        $scope.setCurrentShape = setCurrentShape = function(shape) {
          if (MomentShapes[shape] == null) {
            return;
          }
          $scope.shapeName = shape;
          return $scope.currentShape = {
            shape: shape,
            description: MomentShapes[shape].description || shape,
            moment: MomentShapes[shape].moment,
            crossSection: MomentShapes[shape].crossSection
          };
        };
        $scope.materials = Object.keys(MaterialList);
        $scope.shapes = Object.keys(MomentShapes);
        setCurrentMaterial('Steel');
        setCurrentShape('Square');
        $scope.$watch('materialName', function(newMaterial) {
          $scope.resetLoad();
          return setCurrentMaterial(newMaterial);
        });
        $scope.$watch('shapeName', function(newShape) {
          $scope.resetLoad();
          return setCurrentShape(newShape);
        });
        s = $scope.simulation = {
          applied: 0,
          length: 2,
          base: .25
        };
        $scope.simulation.crossSection = function() {
          var ba;
          ba = parseFloat(s.base);
          return $scope.currentShape.crossSection(ba);
        };
        $scope.simulation.moment = function() {
          return $scope.currentShape.moment($scope.simulation.base);
        };
        $scope.simulation.buckle = function() {
          var ba, buckle, e, l, moment;
          ba = $scope.simulation.crossSection();
          l = parseFloat(s.length);
          e = $scope.currentMaterial.elasticity;
          moment = $scope.simulation.moment();
          buckle = PI_SQUARED * e * moment / (l * l);
          return Math.round(buckle);
        };
        $scope.simulation.compression = function() {
          var area, stress;
          stress = $scope.currentMaterial.stress;
          area = $scope.simulation.crossSection();
          return Math.round(stress * area);
        };
        $scope.simulation.deflection = function(n) {
          if ($scope.simulation.compression() < $scope.simulation.buckle()) {
            return 0;
          }
          if (s.failed()) {
            return parseFloat(s.base);
          } else {
            return 0;
          }
        };
        $scope.simulation.failure = function() {
          return Math.min($scope.simulation.compression(), $scope.simulation.buckle());
        };
        $scope.simulation.failed = function() {
          return s.applied >= s.buckle() || s.applied >= s.compression();
        };
        $scope.showLoad = false;
        $scope.resetLoad = function() {
          $scope.showLoad = false;
          return $scope.simulation.applied = 1;
        };
        $scope.$watch('simulation.length', function() {
          return $scope.resetLoad();
        });
        $scope.$watch('simulation.base', function() {
          return $scope.resetLoad();
        });
        return $scope.calcLoad = function() {
          $scope.simulation.applied = $scope.simulation.failure();
          return $scope.showLoad = true;
        };
      }
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.nbody', ['eau.simulation.service', 'simulation.template', 'eau.simulation.arch', 'graphing.scales', 'graphing.svg']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('nbody', {
        title: 'N-Body Gravity + Collisions'
      });
    }
  ]).directive('nbody', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation',
      controller: function($scope, SimulationFactory) {
        return $scope.simulation = SimulationFactory.build(20, ['/simulation/nbody/nbody.coffee'], function() {
          var i, j, ref, results;
          results = [];
          for (i = j = 0, ref = this.N; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
            this.positions[i * 2] = Math.random();
            results.push(this.positions[i * 2 + 1] = Math.random());
          }
          return results;
        });
      }
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.sdof', ['simulation.sdof.template', 'eau.simulation.compression.materials', 'eau.utilities.scientific', 'graphing.scales', 'graphing.svg', 'ngMaterial', 'eau.navigation', 'eau.arrow']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('sdof', {
        title: 'Single Degree of Freedom'
      });
    }
  ]).directive('sdof', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation/sdof',
      controller: function($scope, MaterialList) {
        var TO_DEG, iPiHalf, s, setCurrentMaterial, theta;
        s = $scope.simulation = {
          length: 15,
          mass: 10000,
          cross: 0.3
        };
        $scope.setCurrentMaterial = setCurrentMaterial = function(materialName) {
          if (MaterialList[materialName] == null) {
            return;
          }
          $scope.materialName = materialName;
          return $scope.currentMaterial = {
            material: materialName,
            density: MaterialList[materialName].density,
            elasticity: MaterialList[materialName].elasticity,
            color: MaterialList[materialName].color,
            stress: MaterialList[materialName].stress
          };
        };
        $scope.materials = ['Steel', 'Wood', 'Concrete'];
        setCurrentMaterial('Steel');
        $scope.$watch('materialName', setCurrentMaterial);
        theta = $scope.theta = Math.sqrt(3) / 2;
        TO_DEG = 180 / Math.PI;
        iPiHalf = 1 / (2 * Math.PI);
        $scope.frequency = function() {
          var k, m;
          k = $scope.stiffness();
          m = s.mass;
          return iPiHalf * Math.sqrt(k / m);
        };
        $scope.stiffness = function() {
          var E, I, L;
          I = Math.pow(s.cross, 4) / 12;
          E = ($scope.currentMaterial.elasticity || 10e6) * 1e3;
          L = s.length;
          return 3 * E * I / (L * L * L);
        };
        return $scope.tick = (function() {
          var angle, direction;
          angle = theta;
          direction = 1;
          return function() {
            var f, p;
            f = $scope.frequency();
            p = direction * f;
            angle += p / 30;
            if (Math.abs(angle) > Math.abs(theta)) {
              direction *= -1;
            }
            return angle;
          };
        })();
      }
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation', ['eau.simulation.service', 'simulation.template', 'eau.simulation.arch', 'graphing.scales', 'graphing.svg']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('falling', {
        title: 'Falling'
      });
    }
  ]).directive('falling', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation',
      controller: function($scope, SimulationFactory) {
        return $scope.simulation = SimulationFactory.build(10, ['/simulation/constraints/ground.coffee', '/simulation/forces/gravity.coffee', '/simulation/forces/bounce.coffee'], function() {
          var i, j, ref, results;
          results = [];
          for (i = j = 0, ref = this.N; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
            this.positions[i * 2] = Math.random();
            results.push(this.positions[i * 2 + 1] = Math.random());
          }
          return results;
        });
      }
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.spring', ['eau.simulation.service', 'simulation.template', 'eau.simulation.arch', 'graphing.scales', 'graphing.svg']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('spring', {
        title: 'Brick on a Spring'
      });
    }
  ]).directive('spring', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation',
      controller: function($scope, SimulationFactory) {
        return $scope.simulation = SimulationFactory.build(2, ['/simulation/spring/spring.coffee'], function() {
          var event, i, j, ref, springList;
          for (i = j = 0, ref = this.N; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
            this.positions[i * 2] = Math.random();
            this.positions[i * 2 + 1] = Math.random();
          }
          springList = {};
          event = {
            event: 'setSprings'
          };
          return this.worker.postMessage(event);
        });
      }
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.tension', ['simulation.tension.template', 'eau.utilities.scientific', 'eau.arrow', 'graphing.scales', 'graphing.svg', 'ngMaterial', 'eau.navigation']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('tension', {
        title: 'Funicular Tension'
      });
    }
  ]).directive('tension', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation/tension',
      controller: function($scope) {
        $scope.materials = [
          {
            name: 'Steel',
            maxStress: 250e6
          }, {
            name: 'Nylon',
            maxStress: 50e6
          }
        ];
        $scope.simulation = {
          width: 4,
          pull: 2,
          diameter: 10,
          material: $scope.materials[0]
        };
        $scope.area = function() {
          var d, d2;
          d = $scope.simulation.diameter;
          d2 = d / 2;
          return Math.PI * d2 * d2;
        };
        $scope.theta = function() {
          var s;
          s = $scope.simulation;
          return Math.atan(s.pull / (s.width / 2));
        };
        $scope.thetaDeg = function() {
          return $scope.theta() * 180 / Math.PI;
        };
        $scope.simulation.stress = function() {
          var a, m;
          a = $scope.area() / 1000;
          m = $scope.simulation.material;
          return m.maxStress * a;
        };
        $scope.simulation.load = function() {
          var s;
          s = Math.sin($scope.theta());
          return 2 * s * $scope.simulation.stress();
        };
        return $scope.showLoad = false;
      }
    };
  });

}).call(this);

(function() {
  angular.module('eau.simulation.truss', ['eau.simulation.truss.shapes', 'eau.simulation.compression.materials', 'simulation.truss.template', 'eau.utilities.scientific', 'eau.arrow', 'graphing.scales', 'graphing.svg', 'ngMaterial', 'eau.navigation']).config([
    'SimulationNavProvider', function(sims) {
      return sims.sim('truss', {
        title: 'Truss'
      });
    }
  ]).directive('truss', function() {
    return {
      restrict: 'E',
      templateUrl: 'simulation/truss',
      controller: function($scope, Trusses, MaterialList, $mdDialog) {
        var currentTruss, currentTrussID, s, trussID;
        $scope.ex = {
          load: {
            min: 10,
            max: 6270
          }
        };
        $scope.loading = ['Center', 'Left', 'Even'];
        s = $scope.simulation = {
          height: 3,
          span: 40,
          load: 120,
          loading: $scope.loading[0],
          form: 'Howe'
        };
        currentTruss = null;
        currentTrussID = '';
        $scope.forms = Object.keys(Trusses);
        $scope.truss = function() {
          if (currentTrussID !== trussID()) {
            currentTrussID = trussID();
            currentTruss = Trusses[s.form][s.loading](s.span, s.height, s.load);
          }
          return currentTruss;
        };
        trussID = function() {
          return s.form + " " + s.span + "x" + s.height + " @  " + s.load + "kN " + s.loading;
        };
        return $scope.reset = function() {
          return currentTrussID = trussID();
        };
      }
    };
  });

}).call(this);
