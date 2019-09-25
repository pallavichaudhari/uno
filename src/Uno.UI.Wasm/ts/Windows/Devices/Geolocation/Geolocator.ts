﻿namespace Windows.Devices.Geolocation {

    enum GeolocationAccessStatus {
        Allowed = "Allowed",
        Denied = "Denied",
        Unspecified = "Unspecified"
    }

    export class Geolocator {

        private static dispatchAccessRequest: (serializedAccessStatus: string) => number;
        private static dispatchGeoposition: (geopositionRequestResult: string, requestId: string) => number;
        private static dispatchError: (geopositionRequestResult: string, requestId: string) => number;

        public static initialize() {
            if (!this.dispatchAccessRequest) {
                this.dispatchAccessRequest = (<any>Module).mono_bind_static_method("[Uno] Windows.Devices.Geolocation.Geolocator:DispatchAccessRequest");
            }
            if (!this.dispatchError) {
                this.dispatchError = (<any>Module).mono_bind_static_method("[Uno] Windows.Devices.Geolocation.Geolocator:DispatchError");
            }
            if (!this.dispatchGeoposition) {
                this.dispatchGeoposition = (<any>Module).mono_bind_static_method("[Uno] Windows.Devices.Geolocation.Geolocator:DispatchGeoposition");
            }
        }

        public static requestAccess() {
            Geolocator.initialize();
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (_) => { Geolocator.dispatchAccessRequest(GeolocationAccessStatus.Allowed); },
                    (error) => {
                        if (error.code == error.PERMISSION_DENIED) {
                            Geolocator.dispatchAccessRequest(GeolocationAccessStatus.Denied);
                        }
                        else if (
                            error.code == error.POSITION_UNAVAILABLE ||
                            error.code == error.TIMEOUT) {
                            //position unavailable but we still have permission
                            Geolocator.dispatchAccessRequest(GeolocationAccessStatus.Allowed);
                        } else {
                            Geolocator.dispatchAccessRequest(GeolocationAccessStatus.Unspecified);
                        }
                    },
                    { enableHighAccuracy: false, maximumAge: 86400000, timeout: 100 });
            } else {
                Geolocator.dispatchAccessRequest(GeolocationAccessStatus.Unspecified);
            }
        }

        public static getGeoposition(
            desiredAccuracyInMeters: number,
            maximumAge: number,
            timeout: number,
            requestId: string) {
            Geolocator.initialize();
            if (navigator.geolocation) {
                if (desiredAccuracyInMeters < 300) {
                    this.getAccurateCurrentPosition(
                        (position) => Geolocator.handleGeoposition(position, requestId),
                        (error) => Geolocator.handleError(error, requestId),
                        desiredAccuracyInMeters,
                        { enableHighAccuracy: true, maximumAge: maximumAge, timeout: timeout });
                } else {
                    navigator.geolocation.getCurrentPosition(
                        (position) => Geolocator.handleGeoposition(position, requestId),
                        (error) => Geolocator.handleError(error, requestId),
                        { enableHighAccuracy: false, maximumAge: maximumAge, timeout: timeout });
                }
            }
            else {
                Geolocator.dispatchError("NotAvailable", requestId);
            }
        }

        private static handleGeoposition(position: Position, requestId: string) {
            Geolocator.dispatchGeoposition(
                position.coords.latitude + ":" +
                position.coords.longitude + ":" +
                position.coords.altitude + ":" +
                position.coords.altitudeAccuracy + ":" +
                position.coords.accuracy + ":" +
                position.coords.heading + ":" +
                position.coords.speed + ":" +
                position.timestamp,
                requestId);
        }

        private static handleError(error: PositionError, requestId: string) {
            Geolocator.dispatchError("Boom!", requestId);
        }

        //this attempts to squeeze out the requested accuracy from the GPS by utilizing the set timeout
        //adapted from https://github.com/gregsramblings/getAccurateCurrentPosition/blob/master/geo.js		
        private static getAccurateCurrentPosition(
            geolocationSuccess: PositionCallback,
            geolocationError: PositionErrorCallback,
            desiredAccuracy: Number,
            options: PositionOptions) {
            var lastCheckedPosition: Position;
            var locationEventCount = 0;
            var watchId: number;
            var timerId: number;

            var checkLocation = function(position: Position) {
                lastCheckedPosition = position;
                locationEventCount = locationEventCount + 1;
                // We ignore the first event unless it's the only one received because some devices seem to send a cached
                // location even when maxaimumAge is set to zero
                if ((position.coords.accuracy <= desiredAccuracy) && (locationEventCount > 1)) {
                    clearTimeout(timerId);
                    navigator.geolocation.clearWatch(watchId);
                    foundPosition(position);
                }
            };

            var stopTrying = function() {
                navigator.geolocation.clearWatch(watchId);
                foundPosition(lastCheckedPosition);
            };

            var onError = function(error: PositionError) {
                clearTimeout(timerId);
                navigator.geolocation.clearWatch(watchId);
                geolocationError(error);
            };

            var foundPosition = function(position: Position) {
                geolocationSuccess(position);
            };


            options.maximumAge = 0; // Force current locations only
            options.enableHighAccuracy = true;

            watchId = navigator.geolocation.watchPosition(checkLocation, onError, options);
            timerId = setTimeout(stopTrying, options.timeout);
        };
    }
}
