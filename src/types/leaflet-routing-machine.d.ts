declare module 'leaflet-routing-machine' {
  // Leaflet loaded from CDN - use global L namespace
  namespace Routing {
    interface ControlOptions {
      waypoints?: L.LatLng[];
      router?: any;
      lineOptions?: {
        styles?: Array<{ color: string; opacity: number; weight: number }>;
        addWaypoints?: boolean;
      };
      routeWhileDragging?: boolean;
      show?: boolean;
      createMarker?: (i: number, waypoint: any, n: number) => L.Marker | null;
    }

    class Control extends L.Control {
      constructor(options?: ControlOptions);
      setWaypoints(waypoints: L.LatLng[]): this;
      on(event: string, callback: (e: any) => void): this;
      getRouter(): any;
      getWaypoints(): L.LatLng[];
    }

    function control(options?: ControlOptions): Control;
  }

  export = Routing;
}

// Extend global L namespace for routing machine
declare namespace L {
  namespace Routing {
    interface ControlOptions {
      waypoints?: any[];
      router?: any;
      lineOptions?: {
        styles?: Array<{ color: string; opacity: number; weight: number }>;
        addWaypoints?: boolean;
      };
      routeWhileDragging?: boolean;
      show?: boolean;
      createMarker?: (i: number, waypoint: any, n: number) => any | null;
    }

    class Control {
      constructor(options?: ControlOptions);
      setWaypoints(waypoints: any[]): this;
      on(event: string, callback: (e: any) => void): this;
      getRouter(): any;
      getWaypoints(): any[];
      addTo(map: any): this;
    }

    function control(options?: ControlOptions): Control;
  }
}
