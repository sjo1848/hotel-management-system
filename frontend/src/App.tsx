import React, { useEffect, useState } from "react";

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
  price_cents: number;
}

function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:3000/api/rooms")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRooms(data);
      })
      .catch(() => setError("No se pudo conectar con la API"));
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>🏨 HMS Elite - Gestión de Habitaciones</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <table
        border={1}
        cellPadding={10}
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f4f4f4" }}>
            <th>Nro</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Precio (ARS)</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>{room.room_number}</td>
              <td>{room.room_type}</td>
              <td>{room.status}</td>
              <td>${(room.price_cents / 100).toLocaleString("es-AR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
