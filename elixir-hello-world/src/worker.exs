defmodule Worker do
  def handle_fetch(request, _env) do
    path = request["url"] || "/"
    {200, %{"content-type" => "text/plain"}, "Hello from Elixir! Path: #{path}"}
  end
end
