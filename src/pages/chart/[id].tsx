import { Navigate, useParams } from "react-router";

export default function ChartRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/explore?chartId=${id ?? ""}`} replace />;
}
