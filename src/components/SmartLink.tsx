import React from "react";
import { Link } from "react-router-dom";

interface SmartLinkProps extends React.ComponentProps<"a"> {
  href: string;
  children: React.ReactNode;
}

/**
 * Componente inteligente que escolhe automaticamente entre <a> para âncoras e <Link> para rotas
 * 
 * - Para âncoras na mesma página: <a href="#id">
 * - Para rotas: <Link to="/path">
 * - Para âncoras em outras páginas: <Link to="/path#id">
 */
export default function SmartLink({ href, children, ...rest }: SmartLinkProps) {
  // Se é uma âncora simples (começa com #)
  if (href.startsWith("#")) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  // Se é uma âncora em outra página (contém /#)
  if (href.includes("/#")) {
    const [path, hash] = href.split("#");
    return (
      <Link to={`${path}#${hash}`} {...rest}>
        {children}
      </Link>
    );
  }

  // Para rotas normais
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}
