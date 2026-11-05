import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./app.css";

type Product = {
  id: string | number;
  name: string;
  price: number | null;
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .order("name")
        .limit(1000);
      if (error) setError(error.message);
      else setProducts(data as Product[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <main className="wrap">Cargando…</main>;
  if (error) return <main className="wrap error">Error: {error}</main>;

  return (
    <main className="wrap">
      <h1>Productos</h1>
      <p className="count">{products.length} productos</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th className="num">Precio de referencia</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="num">
                  {p.price != null ? clp.format(p.price) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}