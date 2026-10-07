import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Vite doesn't resolve Leaflet's default marker icon URLs from its CSS, so
// without this every marker renders as a broken image in the built app.
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export default L;
