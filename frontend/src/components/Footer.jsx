/** Pied de page. L'annee est calculee (elle etait figee a 2025). */
export default function Footer() {
  return (
    <footer className="footer">
      <p>&copy; {new Date().getFullYear()} Application Mes Taches</p>
    </footer>
  );
}
