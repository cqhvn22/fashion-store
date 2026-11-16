package com.fashion.common;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;

public final class Sql {
    private Sql() {}

    public static List<Map<String, Object>> list(DataSource source, String statement, Object... args) {
        try (Connection connection = source.getConnection()) {
            return list(connection, statement, args);
        } catch (SQLException error) {
            throw new IllegalStateException("Database query failed", error);
        }
    }

    public static List<Map<String, Object>> list(Connection connection, String statement, Object... args)
            throws SQLException {
        try (PreparedStatement query = prepare(connection, statement, args);
             ResultSet results = query.executeQuery()) {
            List<Map<String, Object>> rows = new ArrayList<>();
            ResultSetMetaData columns = results.getMetaData();
            while (results.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int index = 1; index <= columns.getColumnCount(); index++) {
                    row.put(camel(columns.getColumnLabel(index)), results.getObject(index));
                }
                rows.add(row);
            }
            return rows;
        }
    }

    public static Map<String, Object> one(DataSource source, String statement, Object... args) {
        List<Map<String, Object>> rows = list(source, statement, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public static Map<String, Object> one(Connection connection, String statement, Object... args)
            throws SQLException {
        List<Map<String, Object>> rows = list(connection, statement, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public static int update(DataSource source, String statement, Object... args) {
        try (Connection connection = source.getConnection()) {
            return update(connection, statement, args);
        } catch (SQLException error) {
            throw new IllegalStateException("Database update failed", error);
        }
    }

    public static int update(Connection connection, String statement, Object... args)
            throws SQLException {
        try (PreparedStatement query = prepare(connection, statement, args)) {
            return query.executeUpdate();
        }
    }

    private static PreparedStatement prepare(Connection connection, String statement, Object... args)
            throws SQLException {
        PreparedStatement query = connection.prepareStatement(statement);
        for (int index = 0; index < args.length; index++) {
            query.setObject(index + 1, args[index]);
        }
        return query;
    }

    private static String camel(String name) {
        StringBuilder result = new StringBuilder();
        boolean upper = false;
        for (char character : name.toCharArray()) {
            if (character == '_') {
                upper = true;
            } else {
                result.append(upper ? Character.toUpperCase(character) : character);
                upper = false;
            }
        }
        return result.toString();
    }
}
